import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  AppActionDefinition,
  AppActionResult,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import axios from 'axios';
import type {
  ActionContext,
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';

/**
 * What a member enters when connecting Attendance — stored encrypted and handed
 * back verbatim as `credential.accessToken` (see the manual-credential connect
 * in `IntegrationsService`). Everything is optional: with no `baseUrl` the
 * built-in ledger (`attendance_punches`) is the system of record.
 */
export interface AttendanceConfig {
  baseUrl?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  officeName?: string;
}

type PunchType = 'CHECK_IN' | 'CHECK_OUT';

/** Razorpay's standard keys are payments-only; people paste them here by mistake. */
export function isRazorpayPaymentKey(key: string | undefined): boolean {
  return !!key && key.trim().startsWith('rzp_');
}

const RAZORPAY_MESSAGE =
  'Razorpay API keys are for payments and can’t record attendance. ' +
  'Enter your HR system’s attendance endpoint, or leave the endpoint empty to use the built-in attendance ledger.';

export function parseAttendanceConfig(raw: unknown): AttendanceConfig {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      value = {};
    }
  }
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const text = (key: string) => (typeof obj[key] === 'string' && (obj[key] as string).trim() ? (obj[key] as string).trim() : undefined);
  return {
    baseUrl: text('baseUrl'),
    apiKey: text('apiKey') ?? text('token'),
    apiKeyHeader: text('apiKeyHeader'),
    officeName: text('officeName'),
  };
}

/** A coordinate from input (agents pass `{{location.latitude}}` as text), or null. */
function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** The UTC day `date` (YYYY-MM-DD) names, or today. */
function utcDay(date: unknown): { start: Date; end: Date; label: string } {
  const label =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const start = new Date(`${label}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000), label };
}

/**
 * Office attendance: check-in / check-out punches for the person an action
 * runs as. Punches land in the workspace ledger; when an HR system endpoint is
 * configured they are sent there first and only recorded once it accepts them.
 */
@Injectable()
export class AttendanceProvider implements ProviderAdapter {
  readonly providerId = 'ATTENDANCE';
  private readonly logger = new Logger(AttendanceProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ssrfGuard: SSRFGuardService,
  ) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Office Attendance',
      description:
        'Check in and out of the office automatically. Uses the built-in attendance ledger, or forwards punches to your HR system.',
      category: 'Productivity & Project Management',
      connectorCategory: 'productivity',
      authType: 'API_KEY_HEADER',
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: true,
      scopes: [
        { scope: 'attendance:read', description: 'Read attendance status and daily hours', required: true },
        { scope: 'attendance:write', description: 'Record check-in and check-out punches', required: true },
      ],
    };
  }

  isServerConfigured(): boolean {
    return true;
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const config = parseAttendanceConfig(credential.accessToken);
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: credential.userId || credential.workspaceId || this.providerId,
      name: config.officeName ? `Office Attendance (${config.officeName})` : 'Office Attendance',
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { mode: config.baseUrl ? 'EXTERNAL_HRMS' : 'INTERNAL_LEDGER', officeName: config.officeName ?? null },
    };
  }

  async disconnect(_credential: ResolvedCredential): Promise<void> {
    // Nothing held on the other side; the ledger stays as the attendance record.
  }

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; message: string; details?: unknown }> {
    const parsed = parseAttendanceConfig(config);
    if (isRazorpayPaymentKey(parsed.apiKey) || parsed.baseUrl?.toLowerCase().includes('api.razorpay.com')) {
      return { success: false, message: RAZORPAY_MESSAGE };
    }
    if (!parsed.baseUrl) {
      return { success: true, message: 'Using the built-in attendance ledger.', details: { mode: 'INTERNAL_LEDGER' } };
    }
    try {
      await this.ssrfGuard.validateUrl(parsed.baseUrl);
      const res = await axios.get(parsed.baseUrl, {
        headers: this.authHeaders(parsed),
        timeout: 5000,
        validateStatus: () => true,
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: `The attendance endpoint refused the API key (HTTP ${res.status}).` };
      }
      if (res.status >= 500) {
        return { success: false, message: `The attendance endpoint is failing (HTTP ${res.status}).` };
      }
      return { success: true, message: `Connected to ${parsed.baseUrl}.`, details: { mode: 'EXTERNAL_HRMS', status: res.status } };
    } catch (error) {
      return { success: false, message: `Couldn’t reach the attendance endpoint: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(): Promise<WebhookProcessResult> {
    return { success: false, eventType: 'unsupported' };
  }

  getActions(): AppActionDefinition[] {
    const punchInput = {
      type: 'object',
      properties: {
        locationName: { type: 'string', description: 'Office the punch is for' },
        latitude: { type: 'number', description: 'Latitude where it happened' },
        longitude: { type: 'number', description: 'Longitude where it happened' },
        note: { type: 'string', description: 'Note saved with the punch' },
        idempotencyKey: { type: 'string', description: 'The same key never punches twice' },
      },
    };
    const dayInput = {
      type: 'object',
      properties: { date: { type: 'string', description: 'Day as YYYY-MM-DD (UTC); defaults to today' } },
    };
    return [
      {
        id: 'get_attendance_status',
        label: 'Get attendance status',
        description: 'Whether you are checked in or out, and today’s hours so far.',
        inputSchema: dayInput,
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'check_in',
        label: 'Check in',
        description: 'Records an office check-in. Does nothing if you are already checked in.',
        inputSchema: punchInput,
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'check_out',
        label: 'Check out',
        description: 'Records an office check-out. Does nothing if you are not checked in.',
        inputSchema: punchInput,
        permissionLevel: 'write',
        requiresConfirmation: false,
      },
      {
        id: 'get_daily_summary',
        label: 'Get daily summary',
        description: 'A day’s punches and total time in the office.',
        inputSchema: dayInput,
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
    context?: ActionContext,
  ): Promise<AppActionResult> {
    const config = parseAttendanceConfig(credential.accessToken);
    if (isRazorpayPaymentKey(config.apiKey)) throw new BadRequestException(RAZORPAY_MESSAGE);

    // Always the person the action runs as — never a user id from `input`,
    // or any agent author could punch for someone else.
    const userId = context?.actingUserId ?? credential.userId;
    const workspaceId = context?.workspaceId ?? credential.workspaceId;
    if (!userId || !workspaceId) {
      throw new BadRequestException('Attendance actions need a person and a workspace to record against.');
    }

    switch (actionId) {
      case 'get_attendance_status':
        return this.status(workspaceId, userId, input);
      case 'get_daily_summary':
        return this.summary(workspaceId, userId, input);
      case 'check_in':
        return this.punch('CHECK_IN', workspaceId, userId, input, config);
      case 'check_out':
        return this.punch('CHECK_OUT', workspaceId, userId, input, config);
      default:
        throw new BadRequestException(`Unknown Attendance action '${actionId}'.`);
    }
  }

  private async lastPunch(workspaceId: string, userId: string) {
    return this.prisma.attendancePunch.findFirst({
      where: { workspaceId, userId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  private async dayPunches(workspaceId: string, userId: string, date: unknown) {
    const day = utcDay(date);
    const punches = await this.prisma.attendancePunch.findMany({
      where: { workspaceId, userId, occurredAt: { gte: day.start, lt: day.end } },
      orderBy: { occurredAt: 'asc' },
    });
    // Sum every in→out pair; an open check-in counts until now (today only).
    let minutes = 0;
    let openedAt: Date | null = null;
    for (const p of punches) {
      if (p.type === 'CHECK_IN' && !openedAt) openedAt = p.occurredAt;
      if (p.type === 'CHECK_OUT' && openedAt) {
        minutes += (p.occurredAt.getTime() - openedAt.getTime()) / 60_000;
        openedAt = null;
      }
    }
    if (openedAt) minutes += (Math.min(Date.now(), day.end.getTime()) - openedAt.getTime()) / 60_000;
    return { day, punches, minutes: Math.max(0, Math.round(minutes)), open: !!openedAt };
  }

  private async status(workspaceId: string, userId: string, input: Record<string, unknown>): Promise<AppActionResult> {
    const last = await this.lastPunch(workspaceId, userId);
    const status = !last ? 'NOT_STARTED' : last.type === 'CHECK_IN' ? 'CHECKED_IN' : 'CHECKED_OUT';
    const { minutes } = await this.dayPunches(workspaceId, userId, input['date']);
    const todayHours = Math.round((minutes / 60) * 10) / 10;
    return {
      success: true,
      message: `Attendance: ${status.replace('_', ' ').toLowerCase()}, ${todayHours}h today.`,
      data: { status, lastPunchAt: last?.occurredAt.toISOString() ?? null, todayHours },
    };
  }

  private async summary(workspaceId: string, userId: string, input: Record<string, unknown>): Promise<AppActionResult> {
    const { day, punches, minutes, open } = await this.dayPunches(workspaceId, userId, input['date']);
    return {
      success: true,
      message: `${day.label}: ${Math.floor(minutes / 60)}h ${minutes % 60}m across ${punches.length} punch${punches.length === 1 ? '' : 'es'}.`,
      data: {
        date: day.label,
        punches: punches.map((p) => ({ id: p.id, type: p.type, at: p.occurredAt.toISOString(), locationName: p.locationName })),
        totalMinutes: minutes,
        status: punches.length === 0 ? 'NOT_STARTED' : open ? 'IN_PROGRESS' : 'COMPLETED',
      },
    };
  }

  private async punch(
    type: PunchType,
    workspaceId: string,
    userId: string,
    input: Record<string, unknown>,
    config: AttendanceConfig,
  ): Promise<AppActionResult> {
    const verb = type === 'CHECK_IN' ? 'Checked in' : 'Checked out';
    const idempotencyKey = typeof input['idempotencyKey'] === 'string' && input['idempotencyKey'] ? input['idempotencyKey'] : null;

    if (idempotencyKey) {
      const replay = await this.prisma.attendancePunch.findUnique({
        where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } },
      });
      if (replay) return this.punchResult(replay, `${verb} already (same request).`, true);
    }

    const last = await this.lastPunch(workspaceId, userId);
    // Checking in twice, or out without being in, would corrupt the day's hours.
    if (type === 'CHECK_IN' ? last?.type === 'CHECK_IN' : last?.type !== 'CHECK_IN') {
      return {
        success: true,
        message: type === 'CHECK_IN' ? 'Already checked in — nothing to do.' : 'Not checked in — nothing to check out of.',
        data: { status: last ? (last.type === 'CHECK_IN' ? 'CHECKED_IN' : 'CHECKED_OUT') : 'NOT_STARTED', skipped: true },
      };
    }

    const record = {
      workspaceId,
      userId,
      type,
      occurredAt: new Date(),
      latitude: coordinate(input['latitude'], 90),
      longitude: coordinate(input['longitude'], 180),
      locationName: (typeof input['locationName'] === 'string' && input['locationName']) || config.officeName || null,
      note: typeof input['note'] === 'string' && input['note'] ? input['note'] : null,
      source: config.baseUrl ? 'EXTERNAL_HRMS' : 'INTERNAL_LEDGER',
      idempotencyKey,
    };

    if (config.baseUrl) {
      // The HR system is the record: if it doesn't take the punch, nothing is
      // recorded here either, and the step fails so the person finds out.
      try {
        await this.ssrfGuard.validateUrl(config.baseUrl);
        await axios.post(
          `${config.baseUrl.replace(/\/+$/, '')}/${type === 'CHECK_IN' ? 'check_in' : 'check_out'}`,
          { ...record, occurredAt: record.occurredAt.toISOString() },
          { headers: { 'Content-Type': 'application/json', ...this.authHeaders(config) }, timeout: 7000 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Attendance ${type} to HR system failed: ${message}`);
        return { success: false, message: `Your HR system didn’t accept the ${verb.toLowerCase()}: ${message}`, data: { status: 'FAILED' } };
      }
    }

    try {
      const saved = await this.prisma.attendancePunch.create({ data: record });
      return this.punchResult(saved, `${verb}${saved.locationName ? ` at ${saved.locationName}` : ''}.`, false);
    } catch (error) {
      // A concurrent retry with the same key won the race — return its punch.
      if (idempotencyKey && (error as { code?: string }).code === 'P2002') {
        const replay = await this.prisma.attendancePunch.findUnique({
          where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } },
        });
        if (replay) return this.punchResult(replay, `${verb} already (same request).`, true);
      }
      throw error;
    }
  }

  private punchResult(
    punch: { id: string; type: string; occurredAt: Date; locationName: string | null },
    message: string,
    replayed: boolean,
  ): AppActionResult {
    return {
      success: true,
      message,
      data: {
        punchId: punch.id,
        status: punch.type === 'CHECK_IN' ? 'CHECKED_IN' : 'CHECKED_OUT',
        at: punch.occurredAt.toISOString(),
        locationName: punch.locationName,
        ...(replayed ? { replayed: true } : {}),
      },
    };
  }

  private authHeaders(config: AttendanceConfig): Record<string, string> {
    if (!config.apiKey) return {};
    const header = config.apiKeyHeader || 'Authorization';
    const value =
      header.toLowerCase() === 'authorization' && !/^bearer /i.test(config.apiKey) ? `Bearer ${config.apiKey}` : config.apiKey;
    return { [header]: value };
  }
}
