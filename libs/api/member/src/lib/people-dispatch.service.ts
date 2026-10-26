import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationCenterService } from '@org/api-notifications';
import { PrismaService } from '@org/database';
import {
  normalizeCelebrationPrefs,
  normalizePrivacy,
  parseYMD,
} from '@org/types';
import {
  planCelebrations,
  planProfileReminders,
  type PlannedDispatch,
  type PlannedReminder,
  type PlannerRecipient,
  type PlannerSubject,
} from './people-planner.js';

/**
 * Hourly birthday / work-anniversary / profile-reminder notifications.
 *
 * Idempotent by construction: every event has a deterministic key written to
 * `PeopleEventDispatch` (primary key) *before* the notification is created, so
 * overlapping or retried runs — and a restart mid-run — can send each event at
 * most once. Hourly cadence is what lets each recipient get theirs at 09:00 in
 * their own timezone.
 */
@Injectable()
export class PeopleDispatchService {
  private readonly logger = new Logger(PeopleDispatchService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationCenterService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'people-celebrations' })
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.run(new Date());
    } catch (err) {
      this.logger.error('People dispatch run failed', err as Error);
    } finally {
      this.running = false;
    }
  }

  async run(now: Date): Promise<{ celebrations: number; reminders: number }> {
    const workspaces = await this.prisma.workspace.findMany({
      where: { members: { some: { status: 'ACTIVE' } } },
      select: { id: true },
    });
    let celebrations = 0;
    let reminders = 0;
    for (const ws of workspaces) {
      try {
        const r = await this.runWorkspace(ws.id, now);
        celebrations += r.celebrations;
        reminders += r.reminders;
      } catch (err) {
        this.logger.error(
          `People dispatch failed for workspace ${ws.id}`,
          err as Error,
        );
      }
    }
    return { celebrations, reminders };
  }

  async runWorkspace(workspaceId: string, now: Date) {
    const [members, profiles, prefs] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE' },
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              jobTitle: true,
              location: true,
              timezone: true,
            },
          },
        },
      }),
      this.prisma.employeeProfile.findMany({ where: { workspaceId } }),
      this.prisma.notificationPreference.findMany({
        where: { workspaceId },
        select: { userId: true, mentionsOnly: true },
      }),
    ]);
    const profileBy = new Map(profiles.map((p) => [p.userId, p]));
    const mentionsOnly = new Map(prefs.map((p) => [p.userId, p.mentionsOnly]));

    const subjects: PlannerSubject[] = members.map((m) => {
      const p = profileBy.get(m.userId);
      return {
        userId: m.userId,
        name: m.user.displayName?.trim() || m.user.name,
        team: p?.team ?? null,
        privacy: normalizePrivacy(p?.privacy),
        birthMonth: p?.birthMonth ?? null,
        birthDay: p?.birthDay ?? null,
        joiningDate: p?.joiningDate
          ? parseYMD(p.joiningDate.toISOString().slice(0, 10))
          : null,
        hasLeft: !!p?.leftAt,
      };
    });
    const recipients: PlannerRecipient[] = members.map((m) => {
      const p = profileBy.get(m.userId);
      return {
        userId: m.userId,
        timezone: m.user.timezone || 'UTC',
        team: p?.team ?? null,
        prefs: normalizeCelebrationPrefs(p?.celebrationPrefs),
        mentionsOnly: mentionsOnly.get(m.userId) ?? false,
      };
    });

    const celebrationPlan = planCelebrations(
      workspaceId,
      now,
      subjects,
      recipients,
    );
    const reminderPlan = planProfileReminders(
      workspaceId,
      now,
      members
        .filter((m) => !profileBy.get(m.userId)?.leftAt)
        .map((m) => {
          const p = profileBy.get(m.userId);
          return {
            userId: m.userId,
            timezone: m.user.timezone || 'UTC',
            prefs: normalizeCelebrationPrefs(p?.celebrationPrefs),
            mentionsOnly: mentionsOnly.get(m.userId) ?? false,
            completion: {
              avatarUrl: m.user.avatarUrl,
              name: m.user.name,
              bio: m.user.bio,
              jobTitle: m.user.jobTitle,
              location: m.user.location,
              timezone: m.user.timezone,
              skills: p?.skills,
            },
          };
        }),
    );

    const celebrations = await this.sendCelebrations(
      workspaceId,
      celebrationPlan,
    );
    const reminders = await this.sendReminders(workspaceId, reminderPlan);
    return { celebrations, reminders };
  }

  /** Claims the key; true only for the single caller that inserted it. */
  private async claim(workspaceId: string, key: string): Promise<boolean> {
    const { count } = await this.prisma.peopleEventDispatch.createMany({
      data: [{ key, workspaceId }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  private async sendCelebrations(workspaceId: string, plan: PlannedDispatch[]) {
    let sent = 0;
    for (const item of plan) {
      if (!(await this.claim(workspaceId, item.key))) continue;
      await this.notifications.create({
        workspaceId,
        recipientId: item.recipientId,
        actorId: null,
        kind: 'SYSTEM',
        title: item.title,
        body: item.body,
        deepLink: `directory?person=${item.subjectId}`,
        resourceType:
          item.kind === 'BIRTHDAY'
            ? 'celebration.birthday'
            : 'celebration.anniversary',
        resourceId: item.key,
      });
      sent++;
    }
    return sent;
  }

  private async sendReminders(workspaceId: string, plan: PlannedReminder[]) {
    let sent = 0;
    for (const item of plan) {
      if (!(await this.claim(workspaceId, item.key))) continue;
      await this.notifications.create({
        workspaceId,
        recipientId: item.recipientId,
        actorId: null,
        kind: 'SYSTEM',
        title: item.title,
        body: item.body,
        deepLink: 'settings/profile?view=work',
        resourceType: 'profile.reminder',
        resourceId: item.key,
      });
      sent++;
    }
    return sent;
  }
}
