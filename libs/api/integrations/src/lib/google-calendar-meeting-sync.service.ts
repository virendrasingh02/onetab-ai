import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AppEvent,
  type IntegrationConnectedEvent,
  type MeetingCancelledEvent,
  type MeetingScheduledEvent,
  type MeetingUpdatedEvent,
} from '@org/api-common';
import { MeetingParticipantRole, MeetingRsvp, MeetingStatus, PrismaService } from '@org/database';
import { IntegrationManagerService } from './core/integration-manager.service.js';
import { memberPreferenceOn } from './core/member-preference.js';
import { GoogleCalendarProvider } from './providers/google-calendar.provider.js';

const SOURCE = 'GOOGLE_CALENDAR';
const PROVIDER = 'GOOGLE_CALENDAR';
const PAST_DAYS = 7;
const FUTURE_DAYS = 60;
/** The Settings switch. Off until a person turns it on: it publishes their calendar to the workspace. */
const SWITCH = 'googleCalendarSync';

type CalendarEvent = Awaited<ReturnType<GoogleCalendarProvider['listEventsForSync']>>[number];

/**
 * Keeps Meetings and a person's Google Calendar in step, both ways, for every
 * workspace where that person has switched "Google Calendar Sync" on.
 *
 * - **Google → Meetings**: each sweep (and on connect / when the switch is
 *   flipped) imports the next two months of events as Meetings organised by
 *   the connected person, updates the ones that changed and cancels the ones
 *   deleted in Google. Private and all-day events are never imported.
 * - **Meetings → Google**: a meeting scheduled, changed or cancelled in the
 *   app is written to the organiser's primary calendar.
 *
 * `Meeting.externalUpdatedAt` remembers Google's own `updated` stamp at the
 * last sync, so what one side just wrote is never re-applied by the other.
 * Imports write straight to the table and raise no meeting events, so an
 * import never pushes itself back or notifies anyone.
 */
@Injectable()
export class GoogleCalendarMeetingSyncService {
  private readonly logger = new Logger(GoogleCalendarMeetingSyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: IntegrationManagerService,
    private readonly google: GoogleCalendarProvider,
  ) {}

  /* --------------------------------------------------------------- pull -- */

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'google-calendar-meetings-sync' })
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.externalIntegration.findMany({
        where: { provider: PROVIDER, status: 'CONNECTED', userId: { not: null } },
        select: { id: true },
        take: 500,
      });
      for (const row of rows) await this.syncIntegration(row.id);
    } finally {
      this.running = false;
    }
  }

  @OnEvent(AppEvent.IntegrationConnected, { async: true })
  async onConnected(e: IntegrationConnectedEvent): Promise<void> {
    await this.syncIntegration(e.integrationId);
  }

  /** Turning the switch on should show the calendar now, not at the next sweep. */
  @OnEvent(AppEvent.SettingsUpdated, { async: true })
  async onSettingsUpdated(e: { category: string; userId: string | null }): Promise<void> {
    if (e.category !== 'memberPreferences' || !e.userId) return;
    const rows = await this.prisma.externalIntegration.findMany({
      where: { provider: PROVIDER, status: 'CONNECTED', userId: e.userId },
      select: { id: true },
    });
    for (const row of rows) await this.syncIntegration(row.id);
  }

  /** Imports one connection's events into each workspace that opted in. Never throws. */
  async syncIntegration(integrationId: string): Promise<{ imported: number; updated: number; cancelled: number }> {
    const totals = { imported: 0, updated: 0, cancelled: 0 };
    try {
      const row = await this.prisma.externalIntegration.findUnique({ where: { id: integrationId } });
      if (!row || row.provider !== PROVIDER || row.status !== 'CONNECTED' || !row.userId) return totals;
      const workspaceIds = await this.optedInWorkspaces(row.userId, row.workspaceId);
      if (workspaceIds.length === 0) return totals;

      const { credential } = await this.manager.resolveCredential(integrationId);
      const now = Date.now();
      const events = await this.google.listEventsForSync(
        credential,
        new Date(now - PAST_DAYS * 86_400_000).toISOString(),
        new Date(now + FUTURE_DAYS * 86_400_000).toISOString(),
      );
      for (const workspaceId of workspaceIds) {
        for (const event of events) {
          const result = await this.applyEvent(workspaceId, row.userId, event);
          if (result) totals[result] += 1;
        }
      }
      await this.prisma.externalIntegration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Syncing Google Calendar connection ${integrationId} into Meetings failed: ${message}`);
      await this.prisma.externalIntegration
        .update({ where: { id: integrationId }, data: { lastErrorAt: new Date(), lastErrorMessage: message.slice(0, 500) } })
        .catch(() => undefined);
    }
    return totals;
  }

  private async optedInWorkspaces(userId: string, pinned: string | null): Promise<string[]> {
    const memberships = pinned
      ? [{ workspaceId: pinned }]
      : await this.prisma.workspaceMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { workspaceId: true } });
    const out: string[] = [];
    for (const m of memberships) {
      if (await memberPreferenceOn(this.prisma, m.workspaceId, userId, SWITCH, false)) out.push(m.workspaceId);
    }
    return out;
  }

  private async applyEvent(
    workspaceId: string,
    organizerId: string,
    event: CalendarEvent,
  ): Promise<'imported' | 'updated' | 'cancelled' | null> {
    if (event.allDay || !event.start || !event.end || event.visibility === 'private' || event.visibility === 'confidential') return null;
    const key = { workspaceId_organizerId_externalSource_externalId: { workspaceId, organizerId, externalSource: SOURCE, externalId: event.id } };
    const existing = await this.prisma.meeting.findUnique({ where: key });
    const remoteUpdated = event.updatedAt ? new Date(event.updatedAt) : null;
    const cancelled = event.status === 'cancelled';

    if (!existing) {
      if (cancelled) return null;
      const attendeeIds = await this.attendeeUserIds(workspaceId, organizerId, event);
      await this.prisma.meeting.create({
        data: {
          workspaceId,
          organizerId,
          title: event.summary,
          description: event.description ?? null,
          location: event.location ?? null,
          startAt: new Date(event.start),
          endAt: new Date(event.end),
          externalSource: SOURCE,
          externalId: event.id,
          externalUpdatedAt: remoteUpdated,
          participants: {
            create: [
              { userId: organizerId, role: MeetingParticipantRole.ORGANIZER, rsvp: MeetingRsvp.ACCEPTED },
              ...attendeeIds.map((userId) => ({ userId, role: MeetingParticipantRole.ATTENDEE })),
            ],
          },
        },
      });
      return 'imported';
    }

    // Already in step — or this is the echo of a push we just made.
    if (existing.deletedAt || (remoteUpdated && existing.externalUpdatedAt && remoteUpdated <= existing.externalUpdatedAt)) return null;

    if (cancelled) {
      if (existing.status === MeetingStatus.CANCELLED || existing.status === MeetingStatus.ENDED) return null;
      await this.prisma.meeting.update({
        where: { id: existing.id },
        data: { status: MeetingStatus.CANCELLED, externalUpdatedAt: remoteUpdated },
      });
      return 'cancelled';
    }
    await this.prisma.meeting.update({
      where: { id: existing.id },
      data: {
        title: event.summary,
        description: event.description ?? null,
        location: event.location ?? null,
        startAt: new Date(event.start),
        endAt: new Date(event.end),
        externalUpdatedAt: remoteUpdated,
        ...(existing.status === MeetingStatus.CANCELLED ? { status: MeetingStatus.SCHEDULED } : {}),
      },
    });
    return 'updated';
  }

  /** Workspace members whose email is on the event — everyone else stays an outside guest. */
  private async attendeeUserIds(workspaceId: string, organizerId: string, event: CalendarEvent): Promise<string[]> {
    const emails = event.attendees.map((a) => a.email?.toLowerCase()).filter((e): e is string => !!e);
    if (emails.length === 0) return [];
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE', userId: { not: organizerId }, user: { email: { in: emails, mode: 'insensitive' } } },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  /* --------------------------------------------------------------- push -- */

  @OnEvent(AppEvent.MeetingScheduled, { async: true })
  async onScheduled(e: MeetingScheduledEvent): Promise<void> {
    await this.push(e.workspaceId, e.meetingId, 'upsert');
  }

  @OnEvent(AppEvent.MeetingUpdated, { async: true })
  async onUpdated(e: MeetingUpdatedEvent): Promise<void> {
    await this.push(e.workspaceId, e.meetingId, 'upsert');
  }

  @OnEvent(AppEvent.MeetingCancelled, { async: true })
  async onCancelled(e: MeetingCancelledEvent): Promise<void> {
    await this.push(e.workspaceId, e.meetingId, 'cancel');
  }

  private async push(workspaceId: string, meetingId: string, mode: 'upsert' | 'cancel'): Promise<void> {
    try {
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: meetingId },
        include: { participants: { include: { user: { select: { email: true } } } } },
      });
      if (!meeting || meeting.workspaceId !== workspaceId) return;
      if (meeting.externalSource && meeting.externalSource !== SOURCE) return;
      if (!(await memberPreferenceOn(this.prisma, workspaceId, meeting.organizerId, SWITCH, false))) return;

      const integration = await this.prisma.externalIntegration.findFirst({
        where: { provider: PROVIDER, status: 'CONNECTED', userId: meeting.organizerId },
        orderBy: { updatedAt: 'desc' },
      });
      if (!integration) return;
      // Writing needs the calendar.events grant; a read-only connection only pulls.
      if (!integration.scopes.includes('calendar.events')) return;
      const { credential } = await this.manager.resolveCredential(integration.id);

      if (mode === 'cancel') {
        if (!meeting.externalId) return;
        await this.google.pushDelete(credential, meeting.externalId);
        return;
      }

      const fields = {
        summary: meeting.title,
        description: meeting.description ?? undefined,
        location: meeting.location ?? undefined,
        start: meeting.startAt.toISOString(),
        end: meeting.endAt.toISOString(),
      };
      if (meeting.externalId) {
        const written = await this.google.pushUpdate(credential, meeting.externalId, fields);
        await this.prisma.meeting.update({
          where: { id: meeting.id },
          data: { externalUpdatedAt: written.updatedAt ? new Date(written.updatedAt) : new Date() },
        });
        return;
      }
      const attendees = meeting.participants
        .filter((p) => p.userId !== meeting.organizerId)
        .map((p) => p.user.email)
        .filter((email): email is string => !!email);
      const created = await this.google.pushCreate(credential, { ...fields, attendees });
      await this.prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          externalSource: SOURCE,
          externalId: created.id,
          externalUpdatedAt: created.updatedAt ? new Date(created.updatedAt) : new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Writing meeting ${meetingId} to Google Calendar failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
