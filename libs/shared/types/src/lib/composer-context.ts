export type ComposerSurfaceKind =
  | 'channel'
  | 'dm'
  | 'group-dm'
  | 'agent'
  | 'coworker'
  | 'app'
  | 'thread';

export interface ComposerContext {
  surfaceKind: ComposerSurfaceKind;
  workspaceId: string | undefined;
  /** Matrix room id. Null while the room is still being provisioned. */
  roomId: string | null;
  /** Postgres channel id — 'channel' surfaces only. */
  channelId?: string;
  /** The other party's platform id — 'dm' | 'agent' | 'coworker' | 'app'. */
  peerId?: string;
  isThread?: boolean;
  threadRootId?: string;
  canManage?: boolean;
}

export interface ComposerMentionMeta {
  id: string;
  kind: 'user' | 'agent' | 'coworker' | 'app' | 'group';
  displayName?: string;
}

export interface ComposerMessageMeta {
  mentions?: ComposerMentionMeta[];
  command?: string;
  commandArguments?: string;
  targetType?: ComposerSurfaceKind;
  targetId?: string;
  workspaceId?: string;
  channelId?: string;
  threadId?: string;
}

/**
 * Computes a dynamic, contextual composer placeholder based on conversation target.
 * Prevents invalid placeholders like "Message #undefined" or "Message [object Object]".
 */
export function getComposerPlaceholder(params: {
  surfaceKind?: ComposerSurfaceKind;
  targetName?: string;
  isEditing?: boolean;
  isThread?: boolean;
}): string {
  if (params.isEditing) {
    return 'Edit your message…';
  }
  if (params.isThread) {
    return 'Reply in thread…';
  }

  const rawName = params.targetName?.trim();
  if (
    !rawName ||
    rawName === 'undefined' ||
    rawName === 'null' ||
    rawName === '[object Object]'
  ) {
    return 'Type a message…';
  }

  switch (params.surfaceKind) {
    case 'channel': {
      const clean = rawName.replace(/^#/, '');
      return clean ? `Message #${clean}` : 'Message channel…';
    }
    case 'dm': {
      const clean = rawName.replace(/^@/, '');
      return clean ? `Message @${clean}` : 'Message user…';
    }
    case 'agent':
      return `Ask ${rawName} anything`;
    case 'coworker':
      return `Message ${rawName}`;
    case 'app':
      return `Message ${rawName}`;
    case 'group-dm':
      return `Message ${rawName}`;
    default:
      return `Message ${rawName}`;
  }
}
