import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import { WorkspaceAuditService } from '@org/api-workspace';
import {
  WorkspacePermission,
  computeProfileCompletion,
  isValidMonthDay,
  normalizeCelebrationPrefs,
  normalizePrivacy,
  roleHasPermission,
  type EmployeeCard,
  type EmployeeDirectoryPage,
  type EmployeeProfileView,
  type WorkspaceRole,
} from '@org/types';
import type {
  EmployeeDirectoryQuery,
  UpdateCelebrationPrefsInput,
  UpdateEmployeePrivacyInput,
  UpdateEmployeeProfileInput,
  UpdateEmploymentInput,
} from '@org/validation';
import {
  parseLinks,
  toEmployeeCard,
  type CardProfile,
  type CardUser,
} from './employee-card.js';

const USER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  jobTitle: true,
  location: true,
  timezone: true,
  bio: true,
  email: true,
} as const;

/** Upper bound on one workspace roster loaded for directory/celebration passes. */
const ROSTER_CAP = 5000;

export interface PeopleViewer {
  userId: string;
  role: WorkspaceRole;
}

interface RosterRow {
  user: CardUser;
  workspaceEmail: string | null;
  profile: CardProfile | null;
}

const toDate = (s: string | null | undefined): Date | null | undefined =>
  s === undefined
    ? undefined
    : s === null
      ? null
      : new Date(`${s}T00:00:00.000Z`);

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: WorkspaceAuditService,
  ) {}

  private isHr(role: WorkspaceRole): boolean {
    return roleHasPermission(role, WorkspacePermission.MANAGE_MEMBERS);
  }

  /** Active members of exactly this workspace, with their employee rows. */
  private async roster(workspaceId: string): Promise<RosterRow[]> {
    const [members, profiles] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE' },
        select: { email: true, user: { select: USER_SELECT } },
        take: ROSTER_CAP,
      }),
      this.prisma.employeeProfile.findMany({
        where: { workspaceId },
        take: ROSTER_CAP,
      }),
    ]);
    const byUser = new Map(profiles.map((p) => [p.userId, p]));
    return members.map((m) => ({
      user: m.user,
      workspaceEmail: m.email,
      profile: (byUser.get(m.user.id) as CardProfile | undefined) ?? null,
    }));
  }

  private async viewerTeam(
    workspaceId: string,
    userId: string,
  ): Promise<string | null> {
    const p = await this.prisma.employeeProfile.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { team: true },
    });
    return p?.team ?? null;
  }

  private async requireMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: 'ACTIVE' },
      select: { email: true, user: { select: USER_SELECT } },
    });
    // Same answer for "not in this workspace" and "does not exist": no probing.
    if (!member) throw new NotFoundException('Employee not found');
    return member;
  }

  // --- profile ---------------------------------------------------------------

  async getProfile(
    workspaceId: string,
    viewer: PeopleViewer,
    targetUserId: string,
  ): Promise<EmployeeProfileView> {
    const member = await this.requireMember(workspaceId, targetUserId);
    const profile = (await this.prisma.employeeProfile.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    })) as CardProfile | null;
    const isHr = this.isHr(viewer.role);
    const card = toEmployeeCard(member.user, profile, member.email, {
      userId: viewer.userId,
      team: await this.viewerTeam(workspaceId, viewer.userId),
      isHr,
    });

    const view: EmployeeProfileView = {
      ...card,
      editable: { self: card.isSelf, hr: isHr },
    };

    if (card.isSelf || isHr) {
      // Owner (and HR, for the HR-managed part) see the whole record they edit.
      view.completion = this.completionFor(member.user, profile);
    }
    if (card.isSelf) {
      view.privacy = normalizePrivacy(profile?.privacy);
      view.celebrationPrefs = normalizeCelebrationPrefs(
        (profile as unknown as { celebrationPrefs?: unknown } | null)
          ?.celebrationPrefs,
      );
      // The owner always sees their own birthday/dates even when private.
      view.birthday =
        profile?.birthMonth != null && profile.birthDay != null
          ? {
              month: profile.birthMonth,
              day: profile.birthDay,
              ...(profile.birthYear != null ? { year: profile.birthYear } : {}),
            }
          : null;
    }
    return view;
  }

  private completionFor(user: CardUser, profile: CardProfile | null) {
    return computeProfileCompletion({
      avatarUrl: user.avatarUrl,
      name: user.name,
      bio: user.bio,
      jobTitle: user.jobTitle,
      location: user.location,
      timezone: user.timezone,
      phone: profile?.phone,
      skills: profile?.skills,
      interests: profile?.interests,
      links: parseLinks(profile?.links),
      birthMonth: profile?.birthMonth,
      department: profile?.department,
      team: profile?.team,
      joiningDate: profile?.joiningDate
        ? profile.joiningDate.toISOString().slice(0, 10)
        : null,
    });
  }

  /** Employee-editable fields. Only ever writes the caller's own row. */
  async updateOwn(
    workspaceId: string,
    userId: string,
    input: UpdateEmployeeProfileInput,
  ) {
    await this.requireMember(workspaceId, userId);
    const data = {
      ...(input.preferredName !== undefined && {
        preferredName: input.preferredName,
      }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.skills !== undefined && { skills: input.skills }),
      ...(input.interests !== undefined && { interests: input.interests }),
      ...(input.links !== undefined && { links: input.links }),
      ...(input.birthMonth !== undefined && { birthMonth: input.birthMonth }),
      ...(input.birthDay !== undefined && { birthDay: input.birthDay }),
      ...(input.birthYear !== undefined && { birthYear: input.birthYear }),
    };
    if (data.birthMonth === null) {
      // Clearing the birthday clears the year with it.
      data.birthDay = null;
      data.birthYear = null;
    }
    if (
      data.birthMonth != null &&
      data.birthDay != null &&
      !isValidMonthDay(data.birthMonth, data.birthDay)
    ) {
      throw new BadRequestException('Invalid birthday');
    }
    await this.prisma.employeeProfile.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, ...data },
      update: data,
    });
  }

  async updatePrivacy(
    workspaceId: string,
    userId: string,
    input: UpdateEmployeePrivacyInput,
  ) {
    await this.requireMember(workspaceId, userId);
    const existing = await this.prisma.employeeProfile.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { privacy: true },
    });
    const privacy = { ...normalizePrivacy(existing?.privacy), ...input };
    await this.prisma.employeeProfile.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, privacy },
      update: { privacy },
    });
    return privacy;
  }

  async updateCelebrationPrefs(
    workspaceId: string,
    userId: string,
    input: UpdateCelebrationPrefsInput,
  ) {
    await this.requireMember(workspaceId, userId);
    const existing = await this.prisma.employeeProfile.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { celebrationPrefs: true },
    });
    const prefs = {
      ...normalizeCelebrationPrefs(existing?.celebrationPrefs),
      ...input,
    };
    await this.prisma.employeeProfile.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, celebrationPrefs: prefs },
      update: { celebrationPrefs: prefs },
    });
    return prefs;
  }

  /** HR-managed employment data. Caller must hold MANAGE_MEMBERS (controller-gated). */
  async updateEmployment(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    input: UpdateEmploymentInput,
  ) {
    await this.requireMember(workspaceId, targetUserId);
    const before = await this.prisma.employeeProfile.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { department: true, team: true, joiningDate: true, leftAt: true },
    });
    const data = {
      ...(input.department !== undefined && { department: input.department }),
      ...(input.team !== undefined && { team: input.team }),
      ...(input.joiningDate !== undefined && {
        joiningDate: toDate(input.joiningDate),
      }),
      ...(input.leftAt !== undefined && { leftAt: toDate(input.leftAt) }),
    };
    const joining =
      input.joiningDate ??
      before?.joiningDate?.toISOString().slice(0, 10) ??
      null;
    const left =
      input.leftAt !== undefined
        ? input.leftAt
        : (before?.leftAt?.toISOString().slice(0, 10) ?? null);
    if (joining && left && left < joining) {
      throw new BadRequestException(
        'Leaving date cannot be before the joining date',
      );
    }
    await this.prisma.employeeProfile.upsert({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      create: { workspaceId, userId: targetUserId, ...data },
      update: data,
    });
    await this.audit.record({
      workspaceId,
      actorId,
      action: 'employee.employment_updated',
      targetType: 'user',
      targetId: targetUserId,
      metadata: {
        before: {
          department: before?.department ?? null,
          team: before?.team ?? null,
          joiningDate: before?.joiningDate?.toISOString().slice(0, 10) ?? null,
          leftAt: before?.leftAt?.toISOString().slice(0, 10) ?? null,
        },
        changed: input,
      },
    });
  }

  // --- directory -------------------------------------------------------------

  async directory(
    workspaceId: string,
    viewer: PeopleViewer,
    q: EmployeeDirectoryQuery,
  ): Promise<EmployeeDirectoryPage> {
    const rows = await this.roster(workspaceId);
    const viewerTeam =
      rows.find((r) => r.user.id === viewer.userId)?.profile?.team ?? null;
    const isHr = this.isHr(viewer.role);
    const now = new Date();

    let cards: EmployeeCard[] = rows
      .map((r) =>
        toEmployeeCard(
          r.user,
          r.profile,
          r.workspaceEmail,
          { userId: viewer.userId, team: viewerTeam, isHr },
          now,
        ),
      )
      // Former employees stay out of the directory; HR can still open them directly.
      .filter((c) => !c.hasLeft);

    const facets = {
      departments: uniqueSorted(cards.map((c) => c.department)),
      teams: uniqueSorted(cards.map((c) => c.team)),
      locations: uniqueSorted(cards.map((c) => c.location)),
    };

    const needle = q.q?.toLowerCase();
    const eq = (a: string | null, b?: string) =>
      !b || a?.toLowerCase() === b.toLowerCase();
    cards = cards.filter((c) => {
      if (
        !eq(c.department, q.department) ||
        !eq(c.team, q.team) ||
        !eq(c.location, q.location)
      )
        return false;
      if (
        q.skill &&
        !c.skills.some((s) => s.toLowerCase() === q.skill?.toLowerCase())
      )
        return false;
      if (!needle) return true;
      return [
        c.name,
        c.preferredName,
        c.jobTitle,
        c.department,
        c.team,
        c.location,
        ...c.skills,
      ].some((f) => f?.toLowerCase().includes(needle));
    });

    const dir = q.order === 'desc' ? -1 : 1;
    const key = (c: EmployeeCard): string =>
      q.sort === 'department'
        ? (c.department ?? '')
        : q.sort === 'joined'
          ? (c.joiningDate ?? '')
          : c.name;
    cards.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      // Empty values always sink to the bottom, whichever way we sort.
      if (!ka !== !kb) return ka ? -1 : 1;
      return (
        dir * ka.localeCompare(kb, undefined, { sensitivity: 'base' }) ||
        a.name.localeCompare(b.name)
      );
    });

    const start = (q.page - 1) * q.pageSize;
    return {
      items: cards.slice(start, start + q.pageSize),
      total: cards.length,
      page: q.page,
      pageSize: q.pageSize,
      facets,
    };
  }
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v?.trim()))].sort(
    (a, b) => a.localeCompare(b),
  );
}
