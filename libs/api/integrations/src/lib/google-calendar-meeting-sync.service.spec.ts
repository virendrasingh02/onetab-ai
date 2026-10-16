import { describe, expect, it, vi } from 'vitest';
import { GoogleCalendarMeetingSyncService } from './google-calendar-meeting-sync.service.js';

const event = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  status: 'confirmed',
  summary: 'Standup',
  start: '2026-10-20T09:00:00Z',
  end: '2026-10-20T09:30:00Z',
  allDay: false,
  attendees: [{ email: 'a@x.com' }],
  updatedAt: '2026-10-16T10:00:00Z',
  ...over,
});

function setup(opts: { opted: boolean; existing?: Record<string, unknown> | null; events?: unknown[] }) {
  const prisma = {
    externalIntegration: {
      findUnique: vi.fn().mockResolvedValue({ id: 'i1', provider: 'GOOGLE_CALENDAR', status: 'CONNECTED', userId: 'u1', workspaceId: 'w1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    workspaceMemberPreference: { findUnique: vi.fn().mockResolvedValue({ data: { googleCalendarSync: opts.opted } }) },
    workspaceMember: { findMany: vi.fn().mockResolvedValue([{ userId: 'u2' }]) },
    meeting: {
      findUnique: vi.fn().mockResolvedValue(opts.existing ?? null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const google = { listEventsForSync: vi.fn().mockResolvedValue(opts.events ?? [event()]) };
  const manager = { resolveCredential: vi.fn().mockResolvedValue({ credential: {} }) };
  const service = new GoogleCalendarMeetingSyncService(prisma as never, manager as never, google as never);
  return { service, prisma, google };
}

describe('GoogleCalendarMeetingSyncService', () => {
  it('imports nothing until the person turned the switch on', async () => {
    const { service, prisma, google } = setup({ opted: false });
    expect(await service.syncIntegration('i1')).toEqual({ imported: 0, updated: 0, cancelled: 0 });
    expect(google.listEventsForSync).not.toHaveBeenCalled();
    expect(prisma.meeting.create).not.toHaveBeenCalled();
  });

  it('imports an event as a meeting organised by the connected person, with member attendees', async () => {
    const { service, prisma } = setup({ opted: true });
    expect((await service.syncIntegration('i1')).imported).toBe(1);
    const data = prisma.meeting.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ workspaceId: 'w1', organizerId: 'u1', externalSource: 'GOOGLE_CALENDAR', externalId: 'g1', title: 'Standup' });
    expect(data.participants.create.map((p: { userId: string }) => p.userId)).toEqual(['u1', 'u2']);
  });

  it('never imports private or all-day events', async () => {
    const { service, prisma } = setup({ opted: true, events: [event({ visibility: 'private' }), event({ id: 'g2', allDay: true })] });
    await service.syncIntegration('i1');
    expect(prisma.meeting.create).not.toHaveBeenCalled();
  });

  it('skips the echo of its own push but applies a newer remote change', async () => {
    const stale = setup({ opted: true, existing: { id: 'm1', status: 'SCHEDULED', externalUpdatedAt: new Date('2026-10-16T10:00:00Z'), deletedAt: null } });
    expect((await stale.service.syncIntegration('i1')).updated).toBe(0);
    const fresh = setup({ opted: true, existing: { id: 'm1', status: 'SCHEDULED', externalUpdatedAt: new Date('2026-10-15T10:00:00Z'), deletedAt: null } });
    expect((await fresh.service.syncIntegration('i1')).updated).toBe(1);
  });

  it('cancels a meeting whose Google event was deleted', async () => {
    const { service, prisma } = setup({
      opted: true,
      events: [event({ status: 'cancelled' })],
      existing: { id: 'm1', status: 'SCHEDULED', externalUpdatedAt: null, deletedAt: null },
    });
    expect((await service.syncIntegration('i1')).cancelled).toBe(1);
    expect(prisma.meeting.update.mock.calls[0][0].data.status).toBe('CANCELLED');
  });
});
