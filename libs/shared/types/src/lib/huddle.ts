/** Huddles (brief §6 / §7) — DTOs + the connection state machine. */

import type { PublicUser } from './entities.js';

export type HuddleStatus = 'ACTIVE' | 'ENDED';

export interface HuddleParticipantView {
  user: PublicUser;
  joinedAt: string;
  leftAt: string | null;
}

export interface HuddleView {
  id: string;
  channelId: string | null;
  matrixRoomId: string;
  status: HuddleStatus;
  startedAt: string;
  endedAt: string | null;
  startedBy: PublicUser;
  participants: HuddleParticipantView[];
  /** When the viewer joined this huddle, for the "you joined at" marker (§7). */
  viewerJoinedAt: string | null;
}

export interface HuddleConfig {
  /** Base URL of the embedded Element Call surface, or null (presence-only). */
  elementCallUrl: string | null;
}

/* --- Connection state machine (brief §6) -------------------------------- */

export type HuddleConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'interrupted'
  | 'reconnecting'
  | 'failed';

export type HuddleConnectionEvent =
  | 'join' // user asked to join
  | 'media_ready' // the media surface reported itself live
  | 'network_lost'
  | 'network_back'
  | 'retry' // user pressed "Retry", or an auto-retry tick
  | 'reconnect_failed' // retries exhausted
  | 'leave';

/** Max automatic reconnection attempts before surfacing Retry / Leave. */
export const HUDDLE_MAX_RECONNECT_ATTEMPTS = 5;

/**
 * A deterministic reducer for the huddle connection lifecycle:
 * `connecting → connected → interrupted → reconnecting → connected`, and
 * `reconnecting → failed` once retries run out — never a stuck spinner (§6).
 */
export function huddleConnectionReducer(
  state: HuddleConnectionState,
  event: HuddleConnectionEvent,
): HuddleConnectionState {
  if (event === 'leave') return 'idle';

  switch (state) {
    case 'idle':
      return event === 'join' ? 'connecting' : state;
    case 'connecting':
      if (event === 'media_ready') return 'connected';
      if (event === 'network_lost') return 'interrupted';
      if (event === 'reconnect_failed') return 'failed';
      return state;
    case 'connected':
      return event === 'network_lost' ? 'interrupted' : state;
    case 'interrupted':
      if (event === 'network_back' || event === 'retry') return 'reconnecting';
      if (event === 'reconnect_failed') return 'failed';
      return state;
    case 'reconnecting':
      if (event === 'media_ready') return 'connected';
      if (event === 'network_lost') return 'interrupted';
      if (event === 'reconnect_failed') return 'failed';
      return state;
    case 'failed':
      return event === 'retry' ? 'reconnecting' : state;
  }
}

/** True while the huddle is trying to (re)establish media. */
export function isHuddleConnecting(state: HuddleConnectionState): boolean {
  return state === 'connecting' || state === 'reconnecting';
}
