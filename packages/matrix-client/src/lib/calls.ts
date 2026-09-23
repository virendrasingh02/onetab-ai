import { CallEvent, type MatrixCall } from 'matrix-js-sdk';
import { CallErrorCode as SdkCallErrorCode } from 'matrix-js-sdk/lib/webrtc/call.js';
import type { OneTabMatrixClient } from './matrix-client.js';
import {
  MatrixError,
  type Call,
  type CallErrorCode,
  type CallKind,
  type CallQuality,
  type CallState,
  type RoomId,
} from './types.js';

export interface CallMediaConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
}

export interface CallDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

export type CallListener = (call: Call) => void;
export type CallQualityListener = (quality: CallQuality) => void;

/** States a call cannot leave — once reached, a new call may start or ring in. */
const TERMINAL_STATES: ReadonlySet<CallState> = new Set<CallState>([
  'idle',
  'ended',
  'rejected',
  'failed',
  'timeout',
  'busy',
]);

/** True while a call is ringing, connecting or connected — i.e. not over. */
export function isCallLive(state: CallState | null | undefined): boolean {
  return !!state && !TERMINAL_STATES.has(state);
}

/** How often the connection-quality monitor samples WebRTC stats. */
const QUALITY_SAMPLE_MS = 3_000;

/**
 * Round-trip time and packet loss → a label a person can act on. Thresholds
 * follow common VoIP guidance: under 150 ms / 2 % is indistinguishable from
 * in-person; past 400 ms / 8 % speech starts to break up.
 */
export function classifyCallQuality(
  rttMs: number | null,
  lossRatio: number | null,
): CallQuality {
  const rtt = rttMs ?? 0;
  const loss = lossRatio ?? 0;
  if (rtt < 150 && loss < 0.02) return 'excellent';
  if (rtt < 400 && loss < 0.08) return 'good';
  return 'poor';
}

/**
 * Voice and video calling — WebRTC Matrix calling layer.
 *
 * Implements production-ready calling using matrix-js-sdk's WebRTC MatrixCall layer:
 * - Signaling via Matrix events (m.call.invite, m.call.answer, m.call.hangup, m.call.candidates)
 * - Explicit call lifecycle states (idle, initiating, ringing, connecting, connected, reconnecting, ended, rejected, failed, busy, timeout)
 * - Device selection & switching (microphone, camera, speaker)
 * - Audio mute, video toggle, screenshare controls
 * - Connection quality monitoring
 * - Safe track cleanup
 */
export class CallManager {
  private readonly listeners = new Set<CallListener>();
  private readonly qualityListeners = new Set<CallQualityListener>();
  private active: Call | null = null;
  private matrixCall: MatrixCall | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private muted = false;
  private videoEnabled = true;
  private screensharing = false;
  private connectionQuality: CallQuality = 'good';
  private ringingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private selectedAudioInputId: string | null = null;
  private selectedVideoInputId: string | null = null;
  private selectedAudioOutputId: string | null = null;
  private qualityTimer: ReturnType<typeof setInterval> | null = null;
  private lastInboundPackets: { received: number; lost: number } | null = null;

  constructor(private readonly client: OneTabMatrixClient) {}

  private assertRoom(roomId: RoomId): void {
    if (!this.client.getRoom(roomId)) {
      throw new MatrixError('NOT_FOUND', 'That room is not available.');
    }
  }

  on(listener: CallListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onQuality(listener: CallQualityListener): () => void {
    this.qualityListeners.add(listener);
    return () => this.qualityListeners.delete(listener);
  }

  private emit(call: Call): void {
    this.active = call;
    for (const listener of this.listeners) {
      try {
        listener(call);
      } catch (err) {
        console.error('[calls] listener threw', err);
      }
    }
  }

  private emitQuality(quality: CallQuality): void {
    // Sampled every few seconds — only a change is news.
    if (quality === this.connectionQuality) return;
    this.connectionQuality = quality;
    for (const listener of this.qualityListeners) {
      try {
        listener(quality);
      } catch (err) {
        console.error('[calls] quality listener threw', err);
      }
    }
  }

  getActiveCall(): Call | null {
    return this.active;
  }

  getLocalStream(): MediaStream | null {
    return this.matrixCall?.localUsermediaStream ?? this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.matrixCall?.remoteUsermediaStream ?? this.remoteStream;
  }

  getConnectionQuality(): CallQuality {
    return this.connectionQuality;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isVideoEnabled(): boolean {
    return this.videoEnabled;
  }

  isScreensharing(): boolean {
    return this.screensharing;
  }

  getSelectedAudioInputId(): string | null {
    return this.selectedAudioInputId;
  }

  getSelectedVideoInputId(): string | null {
    return this.selectedVideoInputId;
  }

  getSelectedAudioOutputId(): string | null {
    return this.selectedAudioOutputId;
  }

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof RTCPeerConnection !== 'undefined'
    );
  }

  /**
   * Enumerates audio input, audio output, and video input devices.
   */
  async getDevices(): Promise<CallDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput' || d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `${d.kind === 'audioinput' ? 'Microphone' : d.kind === 'videoinput' ? 'Camera' : 'Speaker'} ${index + 1}`,
          kind: d.kind as CallDeviceInfo['kind'],
        }));
    } catch {
      return [];
    }
  }

  /**
   * Receives and tracks an incoming MatrixCall from the homeserver.
   */
  handleIncomingCall(matrixCall: MatrixCall): void {
    if (this.active && isCallLive(this.active.state)) {
      // Already on a call: answer "busy" so the caller's client can say so
      // (it maps `user_busy` to a busy state) instead of ringing out.
      try {
        matrixCall.hangup(SdkCallErrorCode.UserBusy, false);
      } catch {
        // ignore
      }
      return;
    }

    const roomId = matrixCall.roomId;
    const kind: CallKind = matrixCall.type === 'video' ? 'video' : 'voice';
    this.bindMatrixCall(matrixCall, roomId, kind, true);

    // Timeout for incoming call after 60s if not answered
    this.clearRingingTimeout();
    this.ringingTimeoutTimer = setTimeout(() => {
      if (this.active && this.active.id === matrixCall.callId && this.active.state === 'ringing') {
        this.emit({
          ...this.active,
          state: 'timeout',
          errorCode: 'CALL_TIMEOUT',
          errorMessage: 'Call timed out',
          endedAt: Date.now(),
        });
        try {
          matrixCall.reject();
        } catch {
          // ignore
        }
        this.cleanup();
      }
    }, 60_000);
  }

  private clearRingingTimeout(): void {
    if (this.ringingTimeoutTimer) {
      clearTimeout(this.ringingTimeoutTimer);
      this.ringingTimeoutTimer = null;
    }
  }

  private bindMatrixCall(
    matrixCall: MatrixCall,
    roomId: RoomId,
    kind: CallKind,
    isIncoming: boolean,
  ): void {
    this.matrixCall = matrixCall;
    this.videoEnabled = kind === 'video';
    this.muted = false;
    this.screensharing = false;
    this.emitQuality('good');

    const initialCall: Call = {
      id: matrixCall.callId,
      roomId,
      kind,
      state: isIncoming ? 'ringing' : 'connecting',
      isIncoming,
      remoteUserId: matrixCall.getOpponentMember()?.userId,
      startedAt: Date.now(),
    };
    this.emit(initialCall);

    /*
     * A MatrixCall keeps emitting after we have moved on (a late 'ended' after
     * hang-up, an error while tearing down). Those must never touch the call
     * that replaced it, so every handler first checks it is still current.
     */
    const isCurrent = () => this.matrixCall === matrixCall;

    matrixCall.on(CallEvent.State, (state: string) => {
      if (!isCurrent()) return;
      let mappedState: CallState = 'connecting';
      switch (state) {
        case 'ringing':
          mappedState = 'ringing';
          break;
        case 'fledgling':
        case 'wait_local_media':
        case 'create_offer':
        case 'create_answer':
        case 'connecting':
        case 'invite_sent':
          mappedState = 'connecting';
          break;
        case 'connected':
          this.clearRingingTimeout();
          mappedState = 'connected';
          this.startQualityMonitor(matrixCall);
          break;
        case 'ended':
          this.clearRingingTimeout();
          // The SDK reports every finish as 'ended'; the hang-up reason says
          // whether the other side was busy or never picked up.
          mappedState =
            matrixCall.hangupReason === 'user_busy'
              ? 'busy'
              : matrixCall.hangupReason === 'invite_timeout'
                ? 'timeout'
                : 'ended';
          break;
      }
      if (this.active) {
        this.emit({
          ...this.active,
          state: mappedState,
          endedAt: TERMINAL_STATES.has(mappedState)
            ? Date.now()
            : this.active.endedAt,
        });
      }
      if (TERMINAL_STATES.has(mappedState)) {
        this.cleanup();
      }
    });

    matrixCall.on(CallEvent.Error, (err: { code?: string; message?: string }) => {
      if (!isCurrent()) return;
      this.clearRingingTimeout();
      const code: CallErrorCode =
        err?.code === 'user_hangup' ? 'CALL_ENDED' : 'CALL_CONNECTION_FAILED';
      if (this.active) {
        this.emit({
          ...this.active,
          state: 'failed',
          errorCode: code,
          errorMessage: err?.message || 'Call failed',
          endedAt: Date.now(),
        });
      }
      this.cleanup();
    });

    matrixCall.on(CallEvent.FeedsChanged, () => {
      if (!isCurrent()) return;
      this.localStream = matrixCall.localUsermediaStream ?? null;
      this.remoteStream = matrixCall.remoteUsermediaStream ?? null;
      if (this.active) {
        this.emit({ ...this.active });
      }
    });
  }

  /**
   * Starts an outbound voice or video call in the given room.
   */
  async startCall(roomId: RoomId, kind: CallKind): Promise<Call> {
    if (!CallManager.isSupported()) {
      throw new MatrixError(
        'UNSUPPORTED',
        'This browser cannot make calls (no media devices or WebRTC).',
      );
    }
    if (this.active && isCallLive(this.active.state)) {
      throw new MatrixError('UNSUPPORTED', 'A call is already in progress.');
    }
    this.assertRoom(roomId);

    const sdk = this.client.getSdk();
    if (!sdk) {
      throw new MatrixError('SESSION_EXPIRED', 'Matrix client is not ready.');
    }

    try {
      const matrixCall = sdk.createCall(roomId);
      if (!matrixCall) {
        throw new MatrixError('UNSUPPORTED', 'Failed to initialize Matrix call.');
      }

      this.bindMatrixCall(matrixCall, roomId, kind, false);

      // Outgoing ringing timeout (50 seconds)
      this.clearRingingTimeout();
      this.ringingTimeoutTimer = setTimeout(() => {
        if (this.active && this.active.id === matrixCall.callId && (this.active.state === 'connecting' || this.active.state === 'ringing')) {
          this.emit({
            ...this.active,
            state: 'timeout',
            errorCode: 'CALL_TIMEOUT',
            errorMessage: 'Call was not answered in time',
            endedAt: Date.now(),
          });
          try {
            matrixCall.hangup(SdkCallErrorCode.UserHangup, false);
          } catch {
            // ignore
          }
          this.cleanup();
        }
      }, 50_000);

      if (kind === 'video') {
        await matrixCall.placeVideoCall();
      } else {
        await matrixCall.placeVoiceCall();
      }

      const result = this.active;
      if (!result) {
        throw new MatrixError('UNKNOWN', 'Call failed to transition to active state.');
      }
      return result;
    } catch (err) {
      this.clearRingingTimeout();
      this.cleanup();
      if (err instanceof MatrixError) throw err;
      throw new MatrixError(
        'UNKNOWN',
        `Failed to start call: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Answers an incoming call.
   */
  async answerCall(kind?: CallKind): Promise<void> {
    this.clearRingingTimeout();
    if (!this.matrixCall) {
      throw new MatrixError('NOT_FOUND', 'No active call to answer.');
    }
    const isVideo = kind === 'video' || this.matrixCall.type === 'video';
    this.videoEnabled = isVideo;

    try {
      await this.matrixCall.answer(true, isVideo);
      if (this.active) {
        this.emit({ ...this.active, state: 'connecting' });
      }
    } catch (err) {
      if (this.active) {
        this.emit({
          ...this.active,
          state: 'failed',
          errorCode: 'CALL_MEDIA_FAILED',
          errorMessage: err instanceof Error ? err.message : 'Failed to answer call',
          endedAt: Date.now(),
        });
      }
      this.cleanup();
      throw err;
    }
  }

  /**
   * Rejects an incoming call.
   */
  rejectCall(): void {
    this.clearRingingTimeout();
    if (this.matrixCall) {
      try {
        this.matrixCall.reject();
      } catch {
        // ignore
      }
    }
    if (this.active) {
      this.emit({
        ...this.active,
        state: 'rejected',
        endedAt: Date.now(),
      });
    }
    this.cleanup();
  }

  /**
   * Hangs up the active call.
   */
  hangUp(): void {
    this.clearRingingTimeout();
    if (this.matrixCall) {
      try {
        this.matrixCall.hangup(SdkCallErrorCode.UserHangup, false);
      } catch {
        // ignore
      }
    }
    if (this.active && this.active.state !== 'ended') {
      this.emit({
        ...this.active,
        state: 'ended',
        endedAt: Date.now(),
      });
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.clearRingingTimeout();
    this.stopQualityMonitor();
    for (const track of this.localStream?.getTracks() ?? []) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
    for (const track of this.matrixCall?.localUsermediaStream?.getTracks() ?? []) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
    this.localStream = null;
    this.remoteStream = null;
    this.matrixCall = null;
    this.muted = false;
    this.videoEnabled = true;
    this.screensharing = false;
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted;
    if (this.matrixCall) {
      await this.matrixCall.setMicrophoneMuted(muted);
    }
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  async setVideoEnabled(enabled: boolean): Promise<void> {
    this.videoEnabled = enabled;
    if (this.matrixCall) {
      await this.matrixCall.setLocalVideoMuted(!enabled);
    }
    for (const track of this.localStream?.getVideoTracks() ?? []) {
      track.enabled = enabled;
    }
  }

  async setScreensharingEnabled(enabled: boolean): Promise<boolean> {
    if (this.matrixCall) {
      try {
        const success = await this.matrixCall.setScreensharingEnabled(enabled);
        this.screensharing = success;
        return success;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Switches the microphone mid-call. Goes through the SDK's MediaHandler,
   * which re-acquires the stream and replaces the track on the live peer
   * connection — swapping tracks on our own MediaStream copy alone would leave
   * the other side hearing the old (stopped) microphone, i.e. silence.
   */
  async setAudioInputDevice(deviceId: string): Promise<boolean> {
    return this.switchInput('audio', deviceId);
  }

  /** Switches the camera mid-call — see {@link setAudioInputDevice}. */
  async setVideoInputDevice(deviceId: string): Promise<boolean> {
    return this.switchInput('video', deviceId);
  }

  private async switchInput(
    kind: 'audio' | 'video',
    deviceId: string,
  ): Promise<boolean> {
    const sdk = this.client.getSdk();
    if (!sdk) return false;
    try {
      const media = sdk.getMediaHandler();
      if (kind === 'audio') {
        await media.setAudioInput(deviceId);
        this.selectedAudioInputId = deviceId;
      } else {
        await media.setVideoInput(deviceId);
        this.selectedVideoInputId = deviceId;
      }
      this.localStream =
        this.matrixCall?.localUsermediaStream ?? this.localStream;
      // Keep the person's mute / camera-off choice across the swap.
      if (kind === 'audio' && this.muted) await this.setMuted(true);
      if (kind === 'video' && !this.videoEnabled) await this.setVideoEnabled(false);
      if (this.active) this.emit({ ...this.active });
      return true;
    } catch (err) {
      console.warn(`[CallManager] Failed to switch ${kind} input device:`, err);
      return false;
    }
  }

  /**
   * Switches audio output device (speaker) where supported (HTMLMediaElement.setSinkId).
   */
  async setAudioOutputDevice(element: HTMLMediaElement, deviceId: string): Promise<boolean> {
    this.selectedAudioOutputId = deviceId;
    // `setSinkId` is not in every browser (nor in older DOM typings).
    const sink = element as HTMLMediaElement & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };
    if (typeof sink.setSinkId === 'function') {
      try {
        await sink.setSinkId(deviceId);
        return true;
      } catch (err) {
        console.warn('[CallManager] Failed to set sinkId on element:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Samples the peer connection every few seconds: ICE state says whether we
   * are connected at all ("reconnecting" while ICE recovers), round-trip time
   * and inbound packet loss grade how well.
   */
  private startQualityMonitor(matrixCall: MatrixCall): void {
    this.stopQualityMonitor();
    this.emitQuality('good');

    const sample = async () => {
      const peer = matrixCall.peerConn;
      if (!peer || this.matrixCall !== matrixCall) return;
      if (
        peer.iceConnectionState === 'disconnected' ||
        peer.iceConnectionState === 'checking'
      ) {
        this.emitQuality('reconnecting');
        return;
      }
      try {
        const stats = await peer.getStats();
        let rttMs: number | null = null;
        let received = 0;
        let lost = 0;
        stats.forEach((report) => {
          const r = report as Record<string, unknown>;
          if (
            r['type'] === 'candidate-pair' &&
            r['state'] === 'succeeded' &&
            typeof r['currentRoundTripTime'] === 'number'
          ) {
            rttMs = r['currentRoundTripTime'] * 1000;
          }
          if (r['type'] === 'inbound-rtp' && r['kind'] === 'audio') {
            if (typeof r['packetsReceived'] === 'number') received += r['packetsReceived'];
            if (typeof r['packetsLost'] === 'number') lost += r['packetsLost'];
          }
        });
        // Loss over the last interval, not since the call began.
        const previous = this.lastInboundPackets;
        this.lastInboundPackets = { received, lost };
        let lossRatio: number | null = null;
        if (previous) {
          const newReceived = received - previous.received;
          const newLost = Math.max(0, lost - previous.lost);
          const total = newReceived + newLost;
          lossRatio = total > 0 ? newLost / total : 0;
        }
        this.emitQuality(classifyCallQuality(rttMs, lossRatio));
      } catch {
        // getStats can reject while the connection is being torn down.
      }
    };

    void sample();
    this.qualityTimer = setInterval(() => void sample(), QUALITY_SAMPLE_MS);
  }

  private stopQualityMonitor(): void {
    if (this.qualityTimer) clearInterval(this.qualityTimer);
    this.qualityTimer = null;
    this.lastInboundPackets = null;
  }
}

export function createCallManager(client: OneTabMatrixClient): CallManager {
  return new CallManager(client);
}
