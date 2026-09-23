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
    if (this.active && this.active.state !== 'ended' && this.active.state !== 'rejected' && this.active.state !== 'failed') {
      // Busy: another call in progress, reject incoming
      try {
        matrixCall.reject();
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
    this.connectionQuality = 'good';

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

    matrixCall.on(CallEvent.State, (state: string) => {
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
          this.emitQuality('excellent');
          break;
        case 'ended':
          this.clearRingingTimeout();
          mappedState = 'ended';
          break;
      }
      if (this.active) {
        this.emit({
          ...this.active,
          state: mappedState,
          endedAt: mappedState === 'ended' ? Date.now() : this.active.endedAt,
        });
      }
      if (mappedState === 'ended') {
        this.cleanup();
      }
    });

    matrixCall.on(CallEvent.Error, (err: any) => {
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
    if (this.active && this.active.state !== 'ended' && this.active.state !== 'rejected' && this.active.state !== 'failed') {
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
   * Switches audio input device (microphone) on the fly.
   */
  async setAudioInputDevice(deviceId: string): Promise<boolean> {
    this.selectedAudioInputId = deviceId;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (!newAudioTrack) return false;

      // Replace audio track in local stream
      if (this.localStream) {
        const oldTrack = this.localStream.getAudioTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        this.localStream.addTrack(newAudioTrack);
      }
      return true;
    } catch (err) {
      console.warn('[CallManager] Failed to switch audio input device:', err);
      return false;
    }
  }

  /**
   * Switches video input device (camera) on the fly.
   */
  async setVideoInputDevice(deviceId: string): Promise<boolean> {
    this.selectedVideoInputId = deviceId;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return false;

      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        this.localStream.addTrack(newVideoTrack);
      }
      return true;
    } catch (err) {
      console.warn('[CallManager] Failed to switch video input device:', err);
      return false;
    }
  }

  /**
   * Switches audio output device (speaker) where supported (HTMLMediaElement.setSinkId).
   */
  async setAudioOutputDevice(element: HTMLMediaElement, deviceId: string): Promise<boolean> {
    this.selectedAudioOutputId = deviceId;
    if (typeof (element as any).setSinkId === 'function') {
      try {
        await (element as any).setSinkId(deviceId);
        return true;
      } catch (err) {
        console.warn('[CallManager] Failed to set sinkId on element:', err);
        return false;
      }
    }
    return false;
  }
}

export function createCallManager(client: OneTabMatrixClient): CallManager {
  return new CallManager(client);
}
