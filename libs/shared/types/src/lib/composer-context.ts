export type ComposerSurfaceKind =
  | 'channel'
  | 'dm'
  | 'group-dm'
  | 'agent'
  | 'coworker'
  | 'app';

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
}
