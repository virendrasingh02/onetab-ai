export interface AccountDeletionWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface AccountDeletionPreview {
  requiresPassword: boolean;
  requiresTwoFactor: boolean;
  /** Owned workspaces with other members: ownership must move first. */
  workspacesToTransfer: AccountDeletionWorkspace[];
  /** Owned workspaces with nobody else in them: deleted with the account. */
  workspacesToDelete: AccountDeletionWorkspace[];
}

export interface AccountDeletionResult {
  deleted: true;
  /** False when chat erasure failed or the homeserver cannot do it. */
  chatErased: boolean;
  integrationsRevoked: number;
  workspacesDeleted: number;
}

export interface ContentReportReceipt {
  id: string;
  status: string;
}

export interface BlockedUserDto {
  userId: string;
  name: string;
  avatarUrl: string | null;
  matrixUserId: string | null;
  blockedAt: string;
}

export interface ContentReportPerson {
  id: string;
  name: string;
  email: string;
}

export interface ContentReportDto {
  id: string;
  targetType: string;
  targetId: string;
  workspaceId: string | null;
  reason: string;
  details: string | null;
  excerpt: string | null;
  status: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: ContentReportPerson | null;
  targetUser: ContentReportPerson | null;
}
