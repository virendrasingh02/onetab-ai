import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { AttendanceProvider, isRazorpayPaymentKey, parseAttendanceConfig } from './attendance.provider.js';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

/** A tiny in-memory stand-in for the `attendancePunch` table. */
function fakePrisma() {
  const rows: any[] = [];
  let seq = 0;
  const matches = (row: any, where: any) =>
    row.workspaceId === where.workspaceId &&
    row.userId === where.userId &&
    (!where.occurredAt || (row.occurredAt >= where.occurredAt.gte && row.occurredAt < where.occurredAt.lt));
  return {
    rows,
    attendancePunch: {
      findFirst: vi.fn(async ({ where }: any) => [...rows].filter((r) => matches(r, where)).sort((a, b) => b.occurredAt - a.occurredAt)[0] ?? null),
      findMany: vi.fn(async ({ where }: any) => rows.filter((r) => matches(r, where)).sort((a, b) => a.occurredAt - b.occurredAt)),
      findUnique: vi.fn(async ({ where }: any) => {
        const { workspaceId, idempotencyKey } = where.workspaceId_idempotencyKey;
        return rows.find((r) => r.workspaceId === workspaceId && r.idempotencyKey === idempotencyKey) ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `p${++seq}`, ...data, occurredAt: new Date(data.occurredAt.getTime() + seq) };
        rows.push(row);
        return row;
      }),
    },
  };
}

const credential = (config: Record<string, unknown> = {}) => ({
  id: 'int-1',
  provider: 'ATTENDANCE',
  scopeType: 'WORKSPACE' as const,
  workspaceId: 'ws-1',
  userId: 'admin-who-connected',
  accessToken: JSON.stringify(config),
  metadata: {},
  scopes: [],
});

describe('AttendanceProvider', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let ssrf: { validateUrl: ReturnType<typeof vi.fn> };
  let provider: AttendanceProvider;
  const as = { actingUserId: 'alice', workspaceId: 'ws-1' };

  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    prisma = fakePrisma();
    ssrf = { validateUrl: vi.fn().mockResolvedValue(undefined) };
    provider = new AttendanceProvider(prisma as any, ssrf as any);
  });

  it('reads the encrypted config bundle, not the masked metadata', () => {
    expect(parseAttendanceConfig('{"baseUrl":"https://hr.example.com","apiKey":"k"}')).toMatchObject({ baseUrl: 'https://hr.example.com', apiKey: 'k' });
    expect(parseAttendanceConfig('not json')).toEqual({ baseUrl: undefined, apiKey: undefined, apiKeyHeader: undefined, officeName: undefined });
  });

  it('refuses Razorpay payment keys when connecting', async () => {
    expect(isRazorpayPaymentKey('rzp_test_123')).toBe(true);
    expect(isRazorpayPaymentKey('hr_key')).toBe(false);
    const res = await provider.testConnection({ apiKey: 'rzp_live_abc' });
    expect(res.success).toBe(false);
    expect(res.message).toContain('Razorpay');
  });

  it('connects to the built-in ledger with no endpoint, and rejects a refused key', async () => {
    expect((await provider.testConnection({})).success).toBe(true);
    vi.mocked(axios.get).mockResolvedValue({ status: 401 });
    const refused = await provider.testConnection({ baseUrl: 'https://hr.example.com', apiKey: 'bad' });
    expect(refused.success).toBe(false);
    expect(ssrf.validateUrl).toHaveBeenCalledWith('https://hr.example.com');
  });

  it('punches for the acting user — never a user id from input', async () => {
    await provider.executeAction(credential(), 'check_in', { userId: 'mallory', latitude: '12.97', longitude: 77.59 }, as);
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]).toMatchObject({ userId: 'alice', workspaceId: 'ws-1', type: 'CHECK_IN', latitude: 12.97, longitude: 77.59 });
  });

  it('skips a second check-in and a check-out without a check-in', async () => {
    const out = await provider.executeAction(credential(), 'check_out', {}, as);
    expect(out.data).toMatchObject({ skipped: true, status: 'NOT_STARTED' });

    await provider.executeAction(credential(), 'check_in', {}, as);
    const again = await provider.executeAction(credential(), 'check_in', {}, as);
    expect(again.data).toMatchObject({ skipped: true, status: 'CHECKED_IN' });
    expect(prisma.rows).toHaveLength(1);
  });

  it('replays the same punch for the same idempotency key', async () => {
    const first = await provider.executeAction(credential(), 'check_in', { idempotencyKey: 'run-1:punch' }, as);
    await provider.executeAction(credential(), 'check_out', {}, as);
    const retry = await provider.executeAction(credential(), 'check_in', { idempotencyKey: 'run-1:punch' }, as);
    expect(retry.data).toMatchObject({ punchId: first.data?.['punchId'], replayed: true });
    expect(prisma.rows).toHaveLength(2);
  });

  it('reports status and a completed day after in → out', async () => {
    expect((await provider.executeAction(credential(), 'get_attendance_status', {}, as)).data?.['status']).toBe('NOT_STARTED');
    await provider.executeAction(credential(), 'check_in', {}, as);
    expect((await provider.executeAction(credential(), 'get_attendance_status', {}, as)).data?.['status']).toBe('CHECKED_IN');
    await provider.executeAction(credential(), 'check_out', {}, as);
    const summary = await provider.executeAction(credential(), 'get_daily_summary', {}, as);
    expect(summary.data).toMatchObject({ status: 'COMPLETED' });
  });

  it('records nothing and fails the step when the HR system rejects the punch', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('HTTP 500'));
    const res = await provider.executeAction(credential({ baseUrl: 'https://hr.example.com' }), 'check_in', {}, as);
    expect(res.success).toBe(false);
    expect(prisma.rows).toHaveLength(0);
  });

  it('forwards to the HR system first, then mirrors the punch', async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200 });
    const res = await provider.executeAction(credential({ baseUrl: 'https://hr.example.com/', apiKey: 'k' }), 'check_in', {}, as);
    expect(res.success).toBe(true);
    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe('https://hr.example.com/check_in');
    expect(vi.mocked(axios.post).mock.calls[0][2]).toMatchObject({ headers: { Authorization: 'Bearer k' } });
    expect(prisma.rows[0]).toMatchObject({ source: 'EXTERNAL_HRMS' });
  });
});
