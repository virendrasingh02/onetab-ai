import {
  canSeeWith,
  normalizePrivacy,
  parseYMD,
  sameTeam,
  todayInZone,
  yearsOfService,
  type EmployeeCard,
  type EmployeeLink,
} from '@org/types';

export interface CardUser {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  location: string | null;
  timezone: string | null;
  bio: string | null;
  email: string;
}

export interface CardProfile {
  preferredName: string | null;
  phone: string | null;
  department: string | null;
  team: string | null;
  skills: string[];
  interests: string[];
  links: unknown;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  joiningDate: Date | null;
  leftAt: Date | null;
  privacy: unknown;
}

export interface CardViewer {
  userId: string;
  team: string | null;
  /** Holds MANAGE_MEMBERS: sees HR-managed employment dates regardless of the owner's choice. */
  isHr: boolean;
}

const toYMDString = (d: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

export function parseLinks(raw: unknown): EmployeeLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((l) => {
    const o = l as Record<string, unknown>;
    return typeof o?.['label'] === 'string' && typeof o['url'] === 'string'
      ? [{ label: o['label'], url: o['url'] }]
      : [];
  });
}

/**
 * Projects one employee into what `viewer` is allowed to see. This is the one
 * place privacy is decided: callers (profile, directory) never reach into the
 * profile row themselves, so a field cannot leak by being forgotten in one
 * endpoint. Absent keys mean "not permitted", not "empty".
 */
export function toEmployeeCard(
  user: CardUser,
  profile: CardProfile | null,
  workspaceEmail: string | null,
  viewer: CardViewer,
  now: Date = new Date(),
): EmployeeCard {
  const isSelf = viewer.userId === user.id;
  const privacy = normalizePrivacy(profile?.privacy);
  const rel = { isSelf, sameTeam: sameTeam(viewer.team, profile?.team) };

  const card: EmployeeCard = {
    userId: user.id,
    name: user.displayName?.trim() || user.name,
    preferredName: profile?.preferredName ?? null,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    department: profile?.department ?? null,
    team: profile?.team ?? null,
    location: user.location,
    timezone: user.timezone,
    email: workspaceEmail ?? user.email,
    skills: profile?.skills ?? [],
    bio: user.bio,
    hasLeft: !!profile?.leftAt,
    isSelf,
  };

  if (canSeeWith(privacy.contact, rel)) {
    card.phone = profile?.phone ?? null;
    card.links = parseLinks(profile?.links);
    card.interests = profile?.interests ?? [];
  }

  if (
    profile?.birthMonth != null &&
    profile.birthDay != null &&
    canSeeWith(privacy.birthday, rel)
  ) {
    card.birthday = {
      month: profile.birthMonth,
      day: profile.birthDay,
      ...(profile.birthYear != null && (isSelf || !privacy.hideBirthYear)
        ? { year: profile.birthYear }
        : {}),
    };
  }

  if (
    profile?.joiningDate &&
    (viewer.isHr || canSeeWith(privacy.anniversary, rel))
  ) {
    const joined = toYMDString(profile.joiningDate);
    const joinedYmd = joined ? parseYMD(joined) : null;
    card.joiningDate = joined;
    card.yearsOfService = joinedYmd
      ? yearsOfService(joinedYmd, todayInZone(now, user.timezone || 'UTC'))
      : null;
  }

  return card;
}
