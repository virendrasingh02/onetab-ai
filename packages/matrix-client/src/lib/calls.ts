import { CallEvent, type MatrixCall } from 'matrix-js-sdk';
import { CallErrorCode } from 'matrix-js-sdk/lib/webrtc/call.js';
import type { OneTabMatrixClient } from './matrix-client.js';
import {
  MatrixError,
  type Call,
  type CallKind,
  type CallState,
  type RoomId,
} from './types.js';

export interface CallMediaConstraints {
  audio: boolean;
  video: boolean;
}

export type CallListener = (call: Call) => void;

/**
 * Voice and video calling — WebRTC Matrix calling layer.
 *
 * Implements full 1:1 calling using matrix-js-sdk's WebRTC MatrixCall layer:
 * - Signaling via Matrix events (m.call.invite, m.call.answer, m.call.hangup, m.call.candidates)
 * - Local & remote media stream acquisition and binding
 * - Call lifecycle states (ringing, connecting, connected, ended, rejected, failed)
 * - Audio mute, video toggle, and screensharing controls
 */
export class CallManager {
  private readonly listeners = new Set<CallListener>();
  private active: Call | null = null;
  private matrixCall: MatrixCall | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private muted = false;
  private videoEnabled = true;
  private screensharing = false;

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

  getActiveCall(): Call | null {
    return this.active;
  }

  getLocalStream(): MediaStream | null {
    return this.matrixCall?.localUsermediaStream ?? this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.matrixCall?.remoteUsermediaStream ?? this.remoteStream;
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

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof RTCPeerConnection !== 'undefined'
    );
  }

  /**
   * Receives and tracks an incoming MatrixCall from the homeserver.
   */
  handleIncomingCall(matrixCall: MatrixCall): void {
    if (this.active && this.active.state !== 'ended') {
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
          mappedState = 'connected';
          break;
        case 'ended':
          mappedState = 'ended';
          this.cleanup();
          break;
      }
      if (this.active) {
        this.emit({ ...this.active, state: mappedState });
      }
    });

    matrixCall.on(CallEvent.Error, () => {
      if (this.active) {
        this.emit({ ...this.active, state: 'failed' });
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
    if (this.active && this.active.state !== 'ended') {
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
        this.emit({ ...this.active, state: 'failed' });
      }
      this.cleanup();
      throw err;
    }
  }

  /**
   * Rejects an incoming call.
   */
  rejectCall(): void {
    if (this.matrixCall) {
      try {
        this.matrixCall.reject();
      } catch {
        // ignore
      }
    }
    if (this.active) {
      this.emit({ ...this.active, state: 'rejected' });
    }
    this.cleanup();
  }

  /**
   * Hangs up the active call.
   */
  hangUp(): void {
    if (this.matrixCall) {
      try {
        this.matrixCall.hangup(CallErrorCode.UserHangup, false);
      } catch {
        // ignore
      }
    }
    if (this.active && this.active.state !== 'ended') {
      this.emit({ ...this.active, state: 'ended' });
    }
    this.cleanup();
  }

  private cleanup(): void {
    for (const track of this.localStream?.getTracks() ?? []) {
      track.stop();
    }
    for (const track of this.matrixCall?.localUsermediaStream?.getTracks() ?? []) {
      track.stop();
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
}

export function createCallManager(client: OneTabMatrixClient): CallManager {
  return new CallManager(client);
}
