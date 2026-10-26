import { NotFoundException } from '@nestjs/common';
import {
  DEFAULT_CELEBRATION_PREFS,
  DEFAULT_EMPLOYEE_PRIVACY,
  WorkspaceRole,
  parseYMD,
} from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  toEmployeeCard,
  type CardProfile,
  type CardUser,
} from './employee-card.js';
import { PeopleDispatchService } from './people-dispatch.service.js';
import {
  planCelebrations,
  planProfileReminders,
  type PlannerRecipient,
  type PlannerSubject,
} from './people-planner.js';
import { PeopleService } from './people.service.js';

const user: CardUser = {
  id: 'u1',
  name: 'Ada Lovelace',
  displayName: null,
  avatarUrl: null,
  jobTitle: 'Engineer',
  location: 'London',
  timezone: 'UTC',
  bio: null,
  email: 'ada@x.com',
};
const profile = (over: Partial<CardProfile> = {}): CardProfile => ({
  preferredName: null,
  phone: '+1 555 0100',
  department: 'R&D',
  team: 'Core',
  skills: ['TypeScript'],
  interests: [],
  links: [],
  birthMonth: 3,
  birthDay: 4,
  birthYear: 1990,
  joiningDate: new Date('2020-03-04T00:00:00Z'),
  leftAt: null,
  privacy: {},
  ...over,
});
const viewer = (over = {}) => ({
  userId: 'u2',
  team: null,
  isHr: false,
  ...over,
});

describe('toEmployeeCard privacy', () => {
  it('hides birthday + phone by default (privacy-first)', () => {
    const c = toEmployeeCard(user, profile(), null, viewer());
    expect(c.birthday).toBeUndefined();
    expect(c.phone).toBeUndefined();
    expect(c.joiningDate).toBe('2020-03-04'); // anniversary defaults to workspace
  });
  it('shows month/day but not the year when the year is hidden', () => {
    const c = toEmployeeCard(
      user,
      profile({ privacy: { birthday: 'WORKSPACE', hideBirthYear: true } }),
      null,
      viewer(),
    );
    expect(c.birthday).toEqual({ month: 3, day: 4 });
  });
  it('shows the year only when the owner allows it', () => {
    const c = toEmployeeCard(
      user,
      profile({ privacy: { birthday: 'WORKSPACE', hideBirthYear: false } }),
      null,
      viewer(),
    );
    expect(c.birthday?.year).toBe(1990);
  });
  it('TEAM visibility needs the same team', () => {
    const p = profile({ privacy: { birthday: 'TEAM' } });
    expect(
      toEmployeeCard(user, p, null, viewer({ team: 'Core' })).birthday,
    ).toBeTruthy();
    expect(
      toEmployeeCard(user, p, null, viewer({ team: 'Ops' })).birthday,
    ).toBeUndefined();
  });
  it('the owner always sees their own data; HR does not see a private birthday', () => {
    expect(
      toEmployeeCard(user, profile(), null, viewer({ userId: 'u1' })).birthday
        ?.year,
    ).toBe(1990);
    expect(
      toEmployeeCard(user, profile(), null, viewer({ isHr: true })).birthday,
    ).toBeUndefined();
  });
  it('HR sees the joining date even when the anniversary is private', () => {
    const p = profile({ privacy: { anniversary: 'PRIVATE' } });
    expect(toEmployeeCard(user, p, null, viewer()).joiningDate).toBeUndefined();
    expect(
      toEmployeeCard(user, p, null, viewer({ isHr: true })).joiningDate,
    ).toBe('2020-03-04');
  });
});

const subject = (over: Partial<PlannerSubject> = {}): PlannerSubject => ({
  userId: 's1',
  name: 'Sam Doe',
  team: 'Core',
  privacy: { ...DEFAULT_EMPLOYEE_PRIVACY, birthday: 'WORKSPACE' },
  birthMonth: 10,
  birthDay: 26,
  joiningDate: parseYMD('2021-10-26'),
  hasLeft: false,
  ...over,
});
const recipient = (over: Partial<PlannerRecipient> = {}): PlannerRecipient => ({
  userId: 'r1',
  timezone: 'UTC',
  team: null,
  prefs: DEFAULT_CELEBRATION_PREFS,
  mentionsOnly: false,
  ...over,
});
const NOON = new Date('2026-10-26T12:00:00Z');

describe('planCelebrations', () => {
  it('plans a birthday and a 5-year milestone with deterministic keys', () => {
    const plan = planCelebrations('ws', NOON, [subject()], [recipient()]);
    expect(plan.map((p) => p.key).sort()).toEqual([
      'anniversary:ws:s1:r1:2026-10-26',
      'birthday:ws:s1:r1:2026-10-26',
    ]);
    const again = planCelebrations('ws', NOON, [subject()], [recipient()]);
    expect(again.map((p) => p.key)).toEqual(plan.map((p) => p.key)); // same event, same key
  });
  it('never leaks the birth year or age', () => {
    const [b] = planCelebrations(
      'ws',
      NOON,
      [subject({ joiningDate: null })],
      [recipient()],
    );
    expect(`${b.title} ${b.body}`).not.toMatch(/19\d\d|20\d\d|years old/);
  });
  it('skips private birthdays, other teams under TEAM, the subject, and people who left', () => {
    expect(
      planCelebrations(
        'ws',
        NOON,
        [subject({ privacy: DEFAULT_EMPLOYEE_PRIVACY, joiningDate: null })],
        [recipient()],
      ),
    ).toHaveLength(0);
    expect(
      planCelebrations(
        'ws',
        NOON,
        [
          subject({
            privacy: { ...DEFAULT_EMPLOYEE_PRIVACY, birthday: 'TEAM' },
            joiningDate: null,
          }),
        ],
        [recipient({ team: 'Ops' })],
      ),
    ).toHaveLength(0);
    expect(
      planCelebrations('ws', NOON, [subject()], [recipient({ userId: 's1' })]),
    ).toHaveLength(0);
    expect(
      planCelebrations('ws', NOON, [subject({ hasLeft: true })], [recipient()]),
    ).toHaveLength(0);
  });
  it('respects recipient prefs and mentions-only', () => {
    const off = {
      ...DEFAULT_CELEBRATION_PREFS,
      birthdays: false,
      anniversaries: false,
    };
    expect(
      planCelebrations('ws', NOON, [subject()], [recipient({ prefs: off })]),
    ).toHaveLength(0);
    expect(
      planCelebrations(
        'ws',
        NOON,
        [subject()],
        [recipient({ mentionsOnly: true })],
      ),
    ).toHaveLength(0);
  });
  it('honours the lead time and waits for 09:00 in the recipient timezone', () => {
    const lead3 = recipient({
      prefs: { ...DEFAULT_CELEBRATION_PREFS, daysBefore: 3 },
    });
    const early = new Date('2026-10-23T12:00:00Z');
    expect(
      planCelebrations(
        'ws',
        early,
        [subject({ joiningDate: null })],
        [lead3],
      )[0]?.key,
    ).toBe('birthday:ws:s1:r1:2026-10-26');
    expect(
      planCelebrations('ws', NOON, [subject({ joiningDate: null })], [lead3]),
    ).toHaveLength(0);
    // 03:00 UTC is 08:30 in Kolkata → too early there, but 09:30 is fine.
    const kol = recipient({ timezone: 'Asia/Kolkata' });
    expect(
      planCelebrations(
        'ws',
        new Date('2026-10-26T03:00:00Z'),
        [subject({ joiningDate: null })],
        [kol],
      ),
    ).toHaveLength(0);
    expect(
      planCelebrations(
        'ws',
        new Date('2026-10-26T04:00:00Z'),
        [subject({ joiningDate: null })],
        [kol],
      ),
    ).toHaveLength(1);
  });
  it('a leap-day birthday fires on Feb 28 in a non-leap year', () => {
    const s = subject({ birthMonth: 2, birthDay: 29, joiningDate: null });
    expect(
      planCelebrations(
        'ws',
        new Date('2027-02-28T10:00:00Z'),
        [s],
        [recipient()],
      ),
    ).toHaveLength(1);
  });
});

describe('planProfileReminders', () => {
  const cand = (over = {}) => ({
    userId: 'u1',
    timezone: 'UTC',
    prefs: DEFAULT_CELEBRATION_PREFS,
    mentionsOnly: false,
    completion: { name: 'A' },
    ...over,
  });
  it('reminds once per window and stops when complete', () => {
    const a = planProfileReminders('ws', NOON, [cand()]);
    const b = planProfileReminders('ws', new Date('2026-10-26T20:00:00Z'), [
      cand(),
    ]);
    expect(a).toHaveLength(1);
    expect(b[0].key).toBe(a[0].key); // same window → same key → deduped by the ledger
    expect(a[0].missing).not.toContain('department'); // HR-managed items aren't nagged
    const done = cand({
      completion: {
        avatarUrl: 'x',
        name: 'A',
        jobTitle: 'j',
        location: 'l',
        timezone: 'Asia/Kolkata',
        bio: 'b',
        skills: ['s'],
      },
    });
    expect(planProfileReminders('ws', NOON, [done])).toHaveLength(0);
  });
  it('respects opt-out', () => {
    const off = cand({
      prefs: { ...DEFAULT_CELEBRATION_PREFS, profileReminders: false },
    });
    expect(planProfileReminders('ws', NOON, [off])).toHaveLength(0);
  });
});

describe('PeopleDispatchService idempotency', () => {
  it('sends an event only for the run that claims its key', async () => {
    const claimed = new Set<string>();
    const prisma: any = {
      peopleEventDispatch: {
        createMany: vi.fn(async ({ data }: any) => {
          const k = data[0].key;
          if (claimed.has(k)) return { count: 0 };
          claimed.add(k);
          return { count: 1 };
        }),
      },
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: 's1',
            user: {
              name: 'Sam',
              displayName: null,
              avatarUrl: 'a',
              bio: 'b',
              jobTitle: 'j',
              location: 'l',
              timezone: 'UTC',
            },
          },
          {
            userId: 'r1',
            user: {
              name: 'Rae',
              displayName: null,
              avatarUrl: 'a',
              bio: 'b',
              jobTitle: 'j',
              location: 'l',
              timezone: 'UTC',
            },
          },
        ]),
      },
      employeeProfile: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              userId: 's1',
              team: null,
              privacy: { birthday: 'WORKSPACE' },
              birthMonth: 10,
              birthDay: 26,
              joiningDate: null,
              leftAt: null,
              celebrationPrefs: {},
              skills: ['x'],
            },
          ]),
      },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const notifications: any = {
      create: vi.fn().mockResolvedValue({ id: 'n' }),
    };
    const svc = new PeopleDispatchService(prisma, notifications);
    const first = await svc.runWorkspace('ws', NOON);
    const second = await svc.runWorkspace('ws', NOON);
    expect(first.celebrations).toBe(1);
    expect(second.celebrations).toBe(0);
    expect(notifications.create).toHaveBeenCalledTimes(
      first.celebrations + first.reminders,
    );
  });
});

describe('PeopleService', () => {
  let prisma: any;
  let audit: any;
  let svc: PeopleService;
  const member = (id: string, name: string, extra = {}) => ({
    email: null,
    user: { ...user, id, name, ...extra },
  });

  beforeEach(() => {
    prisma = {
      workspaceMember: { findFirst: vi.fn(), findMany: vi.fn() },
      employeeProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
      },
    };
    audit = { record: vi.fn() };
    svc = new PeopleService(prisma, audit);
  });

  it('scopes profile lookups to the workspace and 404s for outsiders', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    await expect(
      svc.getProfile(
        'ws-a',
        { userId: 'u2', role: WorkspaceRole.MEMBER },
        'u1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      prisma.workspaceMember.findFirst.mock.calls[0][0].where,
    ).toMatchObject({ workspaceId: 'ws-a', userId: 'u1', status: 'ACTIVE' });
  });

  it('writes only the caller own row when editing the profile', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(member('u1', 'Ada'));
    await svc.updateOwn('ws', 'u1', { skills: ['go'], birthMonth: null });
    const arg = prisma.employeeProfile.upsert.mock.calls[0][0];
    expect(arg.where.workspaceId_userId).toEqual({
      workspaceId: 'ws',
      userId: 'u1',
    });
    expect(arg.update).toMatchObject({
      skills: ['go'],
      birthMonth: null,
      birthDay: null,
      birthYear: null,
    });
    expect(arg.update).not.toHaveProperty('joiningDate');
    expect(arg.update).not.toHaveProperty('department');
  });

  it('audits employment changes and rejects leaving before joining', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(member('u1', 'Ada'));
    await svc.updateEmployment('ws', 'admin', 'u1', {
      joiningDate: '2020-01-01',
      department: 'R&D',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'employee.employment_updated',
        workspaceId: 'ws',
        actorId: 'admin',
        targetId: 'u1',
      }),
    );
    await expect(
      svc.updateEmployment('ws', 'admin', 'u1', {
        joiningDate: '2020-01-01',
        leftAt: '2019-01-01',
      }),
    ).rejects.toThrow();
  });

  describe('directory', () => {
    beforeEach(() => {
      prisma.workspaceMember.findMany.mockResolvedValue([
        member('u1', 'Ada Lovelace', {
          jobTitle: 'Engineer',
          location: 'London',
        }),
        member('u2', 'Bob Stone', { jobTitle: 'Designer', location: 'Pune' }),
        member('u3', 'Cy Gone', { jobTitle: 'Engineer' }),
      ]);
      prisma.employeeProfile.findMany.mockResolvedValue([
        {
          userId: 'u1',
          department: 'R&D',
          team: 'Core',
          skills: ['Rust'],
          privacy: {},
          leftAt: null,
        },
        {
          userId: 'u2',
          department: 'Design',
          team: 'UX',
          skills: ['Figma'],
          privacy: {},
          leftAt: null,
        },
        {
          userId: 'u3',
          department: 'R&D',
          team: 'Core',
          skills: [],
          privacy: {},
          leftAt: new Date('2025-01-01'),
        },
      ]);
    });
    const q = (over = {}) => ({
      sort: 'name' as const,
      order: 'asc' as const,
      page: 1,
      pageSize: 24,
      ...over,
    });
    const v = { userId: 'u2', role: WorkspaceRole.MEMBER };

    it('searches name, title, department, location and skills; excludes people who left', async () => {
      const all = await svc.directory('ws', v, q());
      expect(all.items.map((i) => i.userId)).toEqual(['u1', 'u2']);
      expect(
        (await svc.directory('ws', v, q({ q: 'figma' }))).items.map(
          (i) => i.userId,
        ),
      ).toEqual(['u2']);
      expect(
        (await svc.directory('ws', v, q({ q: 'london' }))).items.map(
          (i) => i.userId,
        ),
      ).toEqual(['u1']);
      expect(
        (await svc.directory('ws', v, q({ department: 'r&d' }))).items.map(
          (i) => i.userId,
        ),
      ).toEqual(['u1']);
    });
    it('paginates and reports facets', async () => {
      const page = await svc.directory('ws', v, q({ pageSize: 1, page: 2 }));
      expect(page.items.map((i) => i.userId)).toEqual(['u2']);
      expect(page.total).toBe(2);
      expect(page.facets.departments).toEqual(['Design', 'R&D']);
    });
    it('does not leak private fields to other members', async () => {
      const [ada] = (await svc.directory('ws', v, q({ q: 'ada' }))).items;
      expect(ada.phone).toBeUndefined();
      expect(ada.birthday).toBeUndefined();
    });
  });
});
