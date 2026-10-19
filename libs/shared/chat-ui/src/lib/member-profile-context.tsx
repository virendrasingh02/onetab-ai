import { createContext, useContext } from 'react';

/** Workspace roles as the platform stores them (`WorkspaceMember.role`). */
export type MemberWorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

/**
 * What the workspace roster knows about a person, for the hover card and the
 * profile rail. Chat events only carry a Matrix id + display name, so without
 * this the card could never say who owns or administers the workspace.
 */
export interface MemberProfile {
  role: MemberWorkspaceRole;
  title?: string | null;
  bio?: string | null;
  timezone?: string | null;
  joinedAt?: string | null;
  email?: string | null;
  /** Loadable cover image URL; absent → the avatar-matched gradient. */
  coverUrl?: string | null;
}

/** Resolves a user id — platform cuid or `@onetab_<cuid>:server` — to a member. */
export type MemberProfileResolver = (userId: string) => MemberProfile | undefined;

const MemberProfileContext = createContext<MemberProfileResolver | null>(null);

export const MemberProfileProvider = MemberProfileContext.Provider;

export function useMemberProfile(userId?: string): MemberProfile | undefined {
  const resolve = useContext(MemberProfileContext);
  return userId && resolve ? resolve(userId) : undefined;
}

export const MEMBER_ROLE_LABELS: Record<MemberWorkspaceRole, string> = {
  OWNER: 'Workspace Owner',
  ADMIN: 'Workspace Admin',
  MEMBER: 'Member',
  GUEST: 'Guest',
};
