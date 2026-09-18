import { ChannelRole, WorkspaceRole, hasWorkspaceRole } from './enums.js';
import type { ChannelViewer } from './channel-policy.js';
import type { ComposerSurfaceKind } from './composer-context.js';

export type MentionKind = 'user' | 'agent' | 'coworker' | 'app' | 'group';

export interface DetectedMention {
  id: string;
  kind: MentionKind;
  displayName?: string;
}

export interface ComposerReachability {
  userIds: ReadonlySet<string>;      // Matrix user ids currently in the room
  agentIds: ReadonlySet<string>;     // AIAgent ids (type agent), linked+enabled
  coworkerIds: ReadonlySet<string>;  // AIAgent ids (type coworker), linked+enabled
  appIds: ReadonlySet<string>;       // ExternalIntegration ids, linked+enabled
}

export type AddAction =
  | 'channel-member'
  | 'channel-agent'
  | 'channel-app'
  | 'group-dm-member'
  | 'start-group'
  | 'none';

export interface MentionEvaluation {
  reachable: boolean;
  addAction: AddAction;
}

/**
 * Mirrors `ChannelService.assertCanManage`'s predicate exactly, so the
 * button state and the server enforcement can never drift (same discipline
 * `channel-policy.ts` already documents for posting).
 */
export function canManageChannelMembers(
  viewer: Pick<ChannelViewer, 'channelRole' | 'workspaceRole'>,
): boolean {
  if (viewer.channelRole === ChannelRole.ADMIN) return true;
  return (
    viewer.workspaceRole !== null &&
    hasWorkspaceRole(viewer.workspaceRole, WorkspaceRole.ADMIN)
  );
}

/**
 * Pure policy evaluation for a detected mention in a composer context.
 */
export function evaluateMention(
  mention: DetectedMention,
  ctx: {
    surfaceKind: ComposerSurfaceKind;
    reachable: ComposerReachability;
    viewerCanManage: boolean;
  },
): MentionEvaluation {
  // @here, @channel, @all are broadcast mentions; always reachable
  if (mention.kind === 'group') {
    return { reachable: true, addAction: 'none' };
  }

  const { surfaceKind, reachable, viewerCanManage } = ctx;

  switch (surfaceKind) {
    /*
     * A thread reply is posted into the same room as its channel, so it
     * shares the channel's reachability rules exactly — `useComposerControl`
     * populates `reachable`/`viewerCanManage` for a thread the same way it
     * does for the channel itself whenever the thread's context carries a
     * `channelId` (see its `isChannel` gate). A cross-room thread with no
     * `channelId` gets empty agent/coworker/app sets and `viewerCanManage:
     * false` from that same gate, so this still degrades safely for it.
     */
    case 'thread':
    case 'channel': {
      if (mention.kind === 'user') {
        const isReachable = reachable.userIds.has(mention.id);
        return {
          reachable: isReachable,
          addAction: isReachable
            ? 'none'
            : viewerCanManage
            ? 'channel-member'
            : 'none',
        };
      }
      if (mention.kind === 'agent') {
        const isReachable = reachable.agentIds.has(mention.id);
        return {
          reachable: isReachable,
          addAction: isReachable
            ? 'none'
            : viewerCanManage
            ? 'channel-agent'
            : 'none',
        };
      }
      if (mention.kind === 'coworker') {
        const isReachable = reachable.coworkerIds.has(mention.id);
        return {
          reachable: isReachable,
          addAction: isReachable
            ? 'none'
            : viewerCanManage
            ? 'channel-agent'
            : 'none',
        };
      }
      if (mention.kind === 'app') {
        const isReachable = reachable.appIds.has(mention.id);
        return {
          reachable: isReachable,
          addAction: isReachable
            ? 'none'
            : viewerCanManage
            ? 'channel-app'
            : 'none',
        };
      }
      return { reachable: true, addAction: 'none' };
    }

    case 'group-dm': {
      if (mention.kind === 'user') {
        const isReachable = reachable.userIds.has(mention.id);
        return {
          reachable: isReachable,
          addAction: isReachable ? 'none' : 'group-dm-member',
        };
      }
      return { reachable: false, addAction: 'none' };
    }

    case 'dm': {
      if (mention.kind === 'user') {
        const isReachable = reachable.userIds.has(mention.id);
        return {
          reachable: isReachable,
          addAction: isReachable ? 'none' : 'start-group',
        };
      }
      return { reachable: false, addAction: 'none' };
    }

    case 'agent':
    case 'coworker':
    case 'app': {
      const isReachable = reachable.userIds.has(mention.id);
      return {
        reachable: isReachable,
        addAction: 'none',
      };
    }

    default:
      return { reachable: true, addAction: 'none' };
  }
}

/**
 * Evaluates whether group mentions (@here, @channel, @everyone) are permitted.
 * Group mentions are restricted in 1:1 contexts (DMs, AI agents, coworkers, apps)
 * and for workspace guests.
 */
export function canMentionGroups(
  surfaceKind?: ComposerSurfaceKind,
  workspaceRole?: WorkspaceRole | null,
): boolean {
  if (
    !surfaceKind ||
    (surfaceKind !== 'channel' &&
      surfaceKind !== 'group-dm' &&
      surfaceKind !== 'thread')
  ) {
    return false;
  }
  if (workspaceRole === WorkspaceRole.GUEST) {
    return false;
  }
  return true;
}
