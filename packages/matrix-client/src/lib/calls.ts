import type { OneTabMatrixClient } from './matrix-client.js';
import { MatrixError, type Call, type CallKind, type RoomId } from './types.js';

/**
 * Voice and video calling — foundation.
 *
 * Phase 3 establishes the domain model, the state machine and the media
 * plumbing so the UI can be built against a stable contract. Signalling is
 * intentionally left unimplemented: Matrix is mid-transition from legacy 1:1
 * calls (MSC2746) to MatrixRTC/Element Call (MSC3401), and committing to the
 * legacy stack now would mean rewriting this within a release.
 *
 * `startCall` therefore acquires real media and drives real state, but throws
 * `UNSUPPORTED` at the point signalling would begin, rather than silently
 * pretending to connect.
 */

export interface CallMediaConstraints {
  audio: boolean;
  video: boolean;
}

export type CallListener = (call: Call) => void;

export class CallManager {
  private readonly listeners = new Set<CallListener>();
  private active: Call | null = null;
  private localStream: MediaStream | null = null;

  constructor(private readonly client: OneTabMatrixClient) {}

  /** Rejects early when the room is unknown, rather than after prompting. */
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
    for (const listener of this.listeners) listener(call);
  }

  getActiveCall(): Call | null {
    return this.active;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /** True when the browser can source microphone/camera media at all. */
  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof RTCPeerConnection !== 'undefined'
    );
  }

  /**
   * Acquires local media and moves the call to `connecting`.
   *
   * Permission is requested before any signalling so the user is not left in a
   * ringing state that can never connect because the mic was denied.
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

    const call: Call = {
      id: `call-${Date.now()}`,
      roomId,
      kind,
      state: 'connecting',
      isIncoming: false,
      startedAt: Date.now(),
    };
    this.emit(call);

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video',
      });
    } catch {
      const failed: Call = { ...call, state: 'failed' };
      this.emit(failed);
      throw new MatrixError(
        'FORBIDDEN',
        'Microphone or camera permission was denied.',
      );
    }

    // Everything above is production-ready; the next step is MatrixRTC
    // signalling, deliberately deferred.
    this.hangUp();
    throw new MatrixError(
      'UNSUPPORTED',
      'Call signalling is not implemented yet. Media capture and call state are in place; MatrixRTC (MSC3401) signalling lands in a later phase.',
    );
  }

  /** Releases devices and ends the call. Safe to call when idle. */
  hangUp(): void {
    for (const track of this.localStream?.getTracks() ?? []) {
      // Without this the camera light stays on after the call ends.
      track.stop();
    }
    this.localStream = null;

    if (this.active && this.active.state !== 'ended') {
      this.emit({ ...this.active, state: 'ended' });
    }
  }

  setMuted(muted: boolean): void {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  setVideoEnabled(enabled: boolean): void {
    for (const track of this.localStream?.getVideoTracks() ?? []) {
      track.enabled = enabled;
    }
  }
}

export function createCallManager(client: OneTabMatrixClient): CallManager {
  return new CallManager(client);
}
