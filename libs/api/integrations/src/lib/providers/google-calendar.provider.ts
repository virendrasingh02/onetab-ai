import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import axios from 'axios';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  executeWithGoogleAuth,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  type GoogleOAuthConfig,
} from './google-oauth.util.js';

const OAUTH_OPTS: GoogleOAuthConfig = {
  redirectUriEnvKey: 'GOOGLE_CALENDAR_REDIRECT_URI',
  defaultCallbackPath: 'google_calendar',
};

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

interface GCalEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  optional?: boolean;
}

interface GCalEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: GCalEventAttendee[];
  organizer?: { email?: string; displayName?: string };
  recurrence?: string[];
  recurringEventId?: string;
  reminders?: { useDefault?: boolean; overrides?: Array<{ method: string; minutes: number }> };
  created?: string;
  updated?: string;
}

function normalizeEvent(raw: GCalEvent) {
  return {
    id: raw.id,
    status: raw.status,
    summary: raw.summary || '(No title)',
    description: raw.description,
    location: raw.location,
    htmlLink: raw.htmlLink,
    start: raw.start?.dateTime || raw.start?.date,
    end: raw.end?.dateTime || raw.end?.date,
    allDay: Boolean(raw.start?.date && !raw.start?.dateTime),
    timeZone: raw.start?.timeZone,
    attendees: (raw.attendees ?? []).map((a) => ({
      email: a.email,
      name: a.displayName,
      responseStatus: a.responseStatus,
      optional: a.optional,
    })),
    organizer: raw.organizer,
    isRecurring: Boolean(raw.recurrence?.length || raw.recurringEventId),
    reminders: raw.reminders,
    createdAt: raw.created,
    updatedAt: raw.updated,
  };
}

@Injectable()
export class GoogleCalendarProvider implements ProviderAdapter {
  readonly providerId = 'GOOGLE_CALENDAR';
  private readonly logger = new Logger(GoogleCalendarProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Google Calendar',
      description:
        'View, search, and manage events across your Google Calendars — day/week/month scheduling, availability, and meeting creation.',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        {
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          description: 'View your calendars and events',
          required: true,
        },
        {
          scope: 'https://www.googleapis.com/auth/calendar.events',
          description: 'Create, update, and delete events on your behalf',
          required: false,
        },
      ],
    };
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[]; loginHint?: string },
  ): Promise<string> {
    return buildGoogleAuthorizationUrl(this.config, OAUTH_OPTS, CALENDAR_SCOPES, state, options);
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    return exchangeGoogleAuthorizationCode(this.config, OAUTH_OPTS, code, CALENDAR_SCOPES, options);
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    return refreshGoogleAccessToken(this.config, refreshToken);
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const primary = await this.executeWithAuth(credential, (token) =>
      axios.get<{ id: string; summary: string; timeZone: string }>(
        'https://www.googleapis.com/calendar/v3/calendars/primary',
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    return {
      id: credential.id,
      provider: this.providerId,
      accountId: primary.data.id,
      email: primary.data.id,
      name: (credential.metadata['accountName'] as string) || primary.data.summary,
      avatarUrl: credential.metadata['picture'] as string,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { timeZone: primary.data.timeZone },
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    if (credential.accessToken) await revokeGoogleToken(credential.accessToken);
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) {
      return { success: false, message: 'No credential provided for Google Calendar connection test.' };
    }
    try {
      const account = await this.getAccount(credential);
      return {
        success: true,
        message: `Successfully connected to Google Calendar for ${account.email}`,
        details: account,
      };
    } catch (err: any) {
      return { success: false, message: `Google Calendar connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const events = await this.listEvents(credential, {
      timeMin: now.toISOString(),
      timeMax: in30Days.toISOString(),
      maxResults: 50,
    });
    return { success: true, itemsProcessed: events.length, metadata: { upcomingCount: events.length } };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    this.logger.log('Google Calendar does not have an active push-notification channel registered.');
    return { success: true, eventType: 'google_calendar.unsubscribed', data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_events',
        label: 'List events',
        description: 'List events on a calendar within a time range (day/week/month).',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: { type: 'string', description: "Defaults to 'primary'." },
            timeMin: { type: 'string', description: 'ISO 8601 start of range.' },
            timeMax: { type: 'string', description: 'ISO 8601 end of range.' },
            maxResults: { type: 'number' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_events',
        label: 'Search events',
        description: 'Free-text search across event titles, descriptions, and locations.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            timeMin: { type: 'string' },
            timeMax: { type: 'string' },
          },
          required: ['query'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_event',
        label: 'Get event details',
        description: 'Fetch full details (attendees, description, reminders) for one event.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: { type: 'string' },
            eventId: { type: 'string' },
          },
          required: ['eventId'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'check_availability',
        label: 'Check availability',
        description: 'Compute free time slots within a range from real free/busy data.',
        inputSchema: {
          type: 'object',
          properties: {
            timeMin: { type: 'string' },
            timeMax: { type: 'string' },
            durationMinutes: { type: 'number' },
          },
          required: ['timeMin', 'timeMax'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'create_event',
        label: 'Create event',
        description: 'Create a new calendar event, optionally inviting attendees.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            location: { type: 'string' },
            start: { type: 'string', description: 'ISO 8601 datetime.' },
            end: { type: 'string', description: 'ISO 8601 datetime.' },
            attendees: { type: 'array', items: { type: 'string' } },
          },
          required: ['summary', 'start', 'end'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'update_event',
        label: 'Update event',
        description: 'Modify an existing event (e.g. move its time).',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: { type: 'string' },
            eventId: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            location: { type: 'string' },
            start: { type: 'string' },
            end: { type: 'string' },
            attendees: { type: 'array', items: { type: 'string' } },
          },
          required: ['eventId'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'delete_event',
        label: 'Delete event',
        description: 'Cancel and remove an event.',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: { type: 'string' },
            eventId: { type: 'string' },
          },
          required: ['eventId'],
        },
        permissionLevel: 'destructive',
        requiresConfirmation: true,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    switch (actionId) {
      case 'list_events': {
        const events = await this.listEvents(credential, {
          calendarId: str(input['calendarId']),
          timeMin: str(input['timeMin']),
          timeMax: str(input['timeMax']),
          maxResults: num(input['maxResults']),
        });
        return { success: true, message: `Found ${events.length} event(s).`, data: { events } };
      }
      case 'search_events': {
        const events = await this.listEvents(credential, {
          q: String(input['query'] ?? ''),
          timeMin: str(input['timeMin']),
          timeMax: str(input['timeMax']),
        });
        return { success: true, message: `Found ${events.length} matching event(s).`, data: { events } };
      }
      case 'get_event': {
        const event = await this.getEvent(
          credential,
          str(input['calendarId']) ?? 'primary',
          String(input['eventId'] ?? ''),
        );
        return { success: true, message: `Fetched "${event.summary}".`, data: { event } };
      }
      case 'check_availability': {
        const result = await this.checkAvailability(
          credential,
          String(input['timeMin'] ?? ''),
          String(input['timeMax'] ?? ''),
          num(input['durationMinutes']) ?? 30,
        );
        return {
          success: true,
          message: `Found ${result.freeSlots.length} free slot(s) of at least ${result.durationMinutes} minutes.`,
          data: result,
        };
      }
      case 'create_event': {
        const event = await this.createEvent(credential, {
          calendarId: str(input['calendarId']) ?? 'primary',
          summary: String(input['summary'] ?? ''),
          description: str(input['description']),
          location: str(input['location']),
          start: String(input['start'] ?? ''),
          end: String(input['end'] ?? ''),
          attendees: strArray(input['attendees']),
        });
        return { success: true, message: `Created "${event.summary}".`, data: { event } };
      }
      case 'update_event': {
        const event = await this.updateEvent(credential, {
          calendarId: str(input['calendarId']) ?? 'primary',
          eventId: String(input['eventId'] ?? ''),
          summary: str(input['summary']),
          description: str(input['description']),
          location: str(input['location']),
          start: str(input['start']),
          end: str(input['end']),
          attendees: strArray(input['attendees']),
        });
        return { success: true, message: `Updated "${event.summary}".`, data: { event } };
      }
      case 'delete_event': {
        await this.deleteEvent(
          credential,
          str(input['calendarId']) ?? 'primary',
          String(input['eventId'] ?? ''),
        );
        return { success: true, message: 'Event deleted.' };
      }
      default:
        throw new BadRequestException(`Unknown Google Calendar action '${actionId}'.`);
    }
  }

  // --- Real API calls ---------------------------------------------------------

  private async listEvents(
    credential: ResolvedCredential,
    params: {
      calendarId?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      q?: string;
    },
  ) {
    return this.executeWithAuth(credential, async (token) => {
      const res = await axios.get<{ items: GCalEvent[] }>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId || 'primary')}/events`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            timeMin: params.timeMin,
            timeMax: params.timeMax,
            maxResults: params.maxResults ?? 25,
            singleEvents: true,
            orderBy: 'startTime',
            q: params.q,
          },
        },
      );
      return (res.data.items ?? []).map(normalizeEvent);
    });
  }

  private async getEvent(credential: ResolvedCredential, calendarId: string, eventId: string) {
    return this.executeWithAuth(credential, async (token) => {
      const res = await axios.get<GCalEvent>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return normalizeEvent(res.data);
    });
  }

  /**
   * Real availability: pulls actual busy blocks from the Calendar Free/Busy
   * API and computes the complement — never invents open slots.
   */
  private async checkAvailability(
    credential: ResolvedCredential,
    timeMin: string,
    timeMax: string,
    durationMinutes: number,
  ) {
    const busy = await this.executeWithAuth(credential, async (token) => {
      const res = await axios.post<{
        calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
      }>(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        { timeMin, timeMax, items: [{ id: 'primary' }] },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      return res.data.calendars?.['primary']?.busy ?? [];
    });

    const sorted = [...busy]
      .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
      .sort((a, b) => a.start - b.start);

    const rangeStart = new Date(timeMin).getTime();
    const rangeEnd = new Date(timeMax).getTime();
    const durationMs = durationMinutes * 60 * 1000;
    const freeSlots: Array<{ start: string; end: string }> = [];
    let cursor = rangeStart;

    for (const block of sorted) {
      if (block.start - cursor >= durationMs) {
        freeSlots.push({ start: new Date(cursor).toISOString(), end: new Date(block.start).toISOString() });
      }
      cursor = Math.max(cursor, block.end);
    }
    if (rangeEnd - cursor >= durationMs) {
      freeSlots.push({ start: new Date(cursor).toISOString(), end: new Date(rangeEnd).toISOString() });
    }

    return { busy, freeSlots, durationMinutes };
  }

  private async createEvent(
    credential: ResolvedCredential,
    input: {
      calendarId: string;
      summary: string;
      description?: string;
      location?: string;
      start: string;
      end: string;
      attendees?: string[];
    },
  ) {
    return this.executeWithAuth(credential, async (token) => {
      const res = await axios.post<GCalEvent>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events?sendUpdates=all`,
        {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.start },
          end: { dateTime: input.end },
          attendees: (input.attendees ?? []).map((email) => ({ email })),
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      return normalizeEvent(res.data);
    });
  }

  private async updateEvent(
    credential: ResolvedCredential,
    input: {
      calendarId: string;
      eventId: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: string;
      end?: string;
      attendees?: string[];
    },
  ) {
    return this.executeWithAuth(credential, async (token) => {
      const patch: Record<string, unknown> = {};
      if (input.summary !== undefined) patch['summary'] = input.summary;
      if (input.description !== undefined) patch['description'] = input.description;
      if (input.location !== undefined) patch['location'] = input.location;
      if (input.start !== undefined) patch['start'] = { dateTime: input.start };
      if (input.end !== undefined) patch['end'] = { dateTime: input.end };
      if (input.attendees !== undefined) {
        patch['attendees'] = input.attendees.map((email) => ({ email }));
      }

      const res = await axios.patch<GCalEvent>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`,
        patch,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      return normalizeEvent(res.data);
    });
  }

  private async deleteEvent(credential: ResolvedCredential, calendarId: string, eventId: string) {
    await this.executeWithAuth(credential, (token) =>
      axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
  }

  private async executeWithAuth<T>(
    credential: ResolvedCredential,
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    return executeWithGoogleAuth(this.config, credential, fn);
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
function strArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.map((x) => String(x)) : undefined;
}
