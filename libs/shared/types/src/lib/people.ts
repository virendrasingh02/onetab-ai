/**
 * Employee profile & engagement — the pure rules shared by the API and the web.
 *
 * Dates here are calendar dates, never instants: a birthday or a joining date
 * is a day on the calendar, not a moment in some zone, so they travel as
 * `YYYY-MM-DD` strings / month+day pairs and the only timezone work is working
 * out what "today" is for a given viewer.
 */

export type PeopleVisibility = 'PRIVATE' | 'TEAM' | 'WORKSPACE';
export const PEOPLE_VISIBILITIES: readonly PeopleVisibility[] = [
  'PRIVATE',
  'TEAM',
  'WORKSPACE',
];

export interface EmployeePrivacy {
  /** Who sees the day + month of the birthday (and receives its notification). */
  birthday: PeopleVisibility;
  /** Hide the birth year even from people who can see the birthday. */
  hideBirthYear: boolean;
  /** Who sees the joining date / work anniversary. */
  anniversary: PeopleVisibility;
  /** Who sees phone, links and interests. Work email follows the member list. */
  contact: PeopleVisibility;
}

/** Privacy-first: a birthday is opt-in, phone/links are private until shared. */
export const DEFAULT_EMPLOYEE_PRIVACY: EmployeePrivacy = {
  birthday: 'PRIVATE',
  hideBirthYear: true,
  anniversary: 'WORKSPACE',
  contact: 'PRIVATE',
};

export interface CelebrationPrefs {
  birthdays: boolean;
  anniversaries: boolean;
  /** Notify this many days ahead; 0 = on the day. */
  daysBefore: number;
  /** Remind me to finish my own incomplete profile. */
  profileReminders: boolean;
  /** Minimum days between two profile reminders. */
  reminderEveryDays: number;
}
export const CELEBRATION_LEAD_DAYS: readonly number[] = [0, 1, 3, 7];
export const REMINDER_INTERVAL_DAYS: readonly number[] = [7, 14, 30];
export const DEFAULT_CELEBRATION_PREFS: CelebrationPrefs = {
  birthdays: true,
  anniversaries: true,
  daysBefore: 0,
  profileReminders: true,
  reminderEveryDays: 14,
};

const isVisibility = (v: unknown): v is PeopleVisibility =>
  typeof v === 'string' &&
  (PEOPLE_VISIBILITIES as readonly string[]).includes(v);

export function normalizePrivacy(raw: unknown): EmployeePrivacy {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_EMPLOYEE_PRIVACY;
  return {
    birthday: isVisibility(o['birthday']) ? o['birthday'] : d.birthday,
    hideBirthYear:
      typeof o['hideBirthYear'] === 'boolean'
        ? o['hideBirthYear']
        : d.hideBirthYear,
    anniversary: isVisibility(o['anniversary'])
      ? o['anniversary']
      : d.anniversary,
    contact: isVisibility(o['contact']) ? o['contact'] : d.contact,
  };
}

export function normalizeCelebrationPrefs(raw: unknown): CelebrationPrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_CELEBRATION_PREFS;
  const lead = o['daysBefore'];
  const every = o['reminderEveryDays'];
  return {
    birthdays:
      typeof o['birthdays'] === 'boolean' ? o['birthdays'] : d.birthdays,
    anniversaries:
      typeof o['anniversaries'] === 'boolean'
        ? o['anniversaries']
        : d.anniversaries,
    daysBefore:
      typeof lead === 'number' && CELEBRATION_LEAD_DAYS.includes(lead)
        ? lead
        : d.daysBefore,
    profileReminders:
      typeof o['profileReminders'] === 'boolean'
        ? o['profileReminders']
        : d.profileReminders,
    reminderEveryDays:
      typeof every === 'number' && REMINDER_INTERVAL_DAYS.includes(every)
        ? every
        : d.reminderEveryDays,
  };
}

export interface ViewerRelation {
  isSelf: boolean;
  /** Viewer's team equals the subject's team (both non-empty). */
  sameTeam: boolean;
}

/** Whether a viewer inside the workspace falls in `visibility`'s audience. */
export function canSeeWith(
  visibility: PeopleVisibility,
  rel: ViewerRelation,
): boolean {
  if (rel.isSelf) return true;
  if (visibility === 'WORKSPACE') return true;
  if (visibility === 'TEAM') return rel.sameTeam;
  return false;
}

export function sameTeam(a?: string | null, b?: string | null): boolean {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  return !!x && !!y && x === y;
}

// --- calendar dates ------------------------------------------------------------

export interface YMD {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

export const isLeapYear = (y: number): boolean =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    m - 1
  ];
}

/** True for a real calendar month/day; Feb 29 is allowed (a leap-day birthday). */
export function isValidMonthDay(m: number, d: number): boolean {
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1)
    return false;
  return d <= daysInMonth(2000, m); // 2000 is a leap year
}

export function parseYMD(s: string): YMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export const formatYMD = ({ y, m, d }: YMD): string =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const dayNumber = ({ y, m, d }: YMD): number =>
  Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const diffDays = (a: YMD, b: YMD): number => dayNumber(b) - dayNumber(a);

export function addDays(date: YMD, days: number): YMD {
  const t = new Date((dayNumber(date) + days) * 86_400_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** "Today" as a calendar date in `timeZone` (falls back to UTC for a bad zone). */
export function todayInZone(
  now: Date,
  timeZone: string,
): YMD & { hour: number } {
  const read = (zone: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return {
      y: get('year'),
      m: get('month'),
      d: get('day'),
      hour: get('hour'),
    };
  };
  try {
    return read(timeZone || 'UTC');
  } catch {
    return read('UTC');
  }
}

/**
 * The next date on or after `from` that a month/day recurs. A Feb 29 event
 * lands on Feb 28 in non-leap years (the day before, never silently Mar 1).
 */
export function nextOccurrence(month: number, day: number, from: YMD): YMD {
  const inYear = (y: number): YMD => ({
    y,
    m: month,
    d: month === 2 && day === 29 && !isLeapYear(y) ? 28 : day,
  });
  const thisYear = inYear(from.y);
  return diffDays(from, thisYear) >= 0 ? thisYear : inYear(from.y + 1);
}

/** Completed years of service on `today` (never negative). */
export function yearsOfService(joining: YMD, today: YMD): number {
  if (diffDays(joining, today) < 0) return 0;
  const anniv = nextOccurrence(joining.m, joining.d, {
    y: today.y,
    m: 1,
    d: 1,
  });
  const years = today.y - joining.y;
  return diffDays(anniv, today) >= 0 ? years : years - 1;
}

export const isMilestoneYear = (years: number): boolean =>
  years === 1 || years === 3 || (years >= 5 && years % 5 === 0);

export interface AnniversaryInfo {
  date: YMD;
  /** The anniversary number being reached on `date` (1 = first year). */
  years: number;
  isMilestone: boolean;
  daysUntil: number;
}

/** The next work anniversary on or after `today` (the joining day is not one). */
export function nextAnniversary(joining: YMD, today: YMD): AnniversaryInfo {
  let date = nextOccurrence(joining.m, joining.d, today);
  if (date.y <= joining.y) {
    // Joined this year (or later): the first anniversary is next year.
    date = nextOccurrence(joining.m, joining.d, {
      y: joining.y + 1,
      m: 1,
      d: 1,
    });
  }
  const years = date.y - joining.y;
  return {
    date,
    years,
    isMilestone: isMilestoneYear(years),
    daysUntil: diffDays(today, date),
  };
}

// --- profile completion --------------------------------------------------------

export type ProfileSection = 'basics' | 'work' | 'about' | 'privacy';

export interface CompletionItem {
  key: string;
  label: string;
  section: ProfileSection;
  done: boolean;
}

export interface ProfileCompletionInput {
  avatarUrl?: string | null;
  name?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  timezone?: string | null;
  phone?: string | null;
  skills?: readonly string[];
  interests?: readonly string[];
  links?: readonly unknown[];
  birthMonth?: number | null;
  department?: string | null;
  team?: string | null;
  joiningDate?: string | null;
}

const filled = (v?: string | null): boolean => !!v && v.trim().length > 0;

/**
 * Completion over the fields that apply. Recommended fields always count;
 * optional ones (phone, interests, links, birthday) only ever add credit once
 * filled and never lower a score, so an employee is not nagged for something
 * they are free to leave out.
 */
export function computeProfileCompletion(input: ProfileCompletionInput): {
  percent: number;
  items: CompletionItem[];
  missing: CompletionItem[];
} {
  const recommended: CompletionItem[] = [
    {
      key: 'avatar',
      label: 'Profile photo',
      section: 'basics',
      done: filled(input.avatarUrl),
    },
    {
      key: 'name',
      label: 'Full name',
      section: 'basics',
      done: filled(input.name),
    },
    {
      key: 'jobTitle',
      label: 'Job title',
      section: 'work',
      done: filled(input.jobTitle),
    },
    {
      key: 'location',
      label: 'Location',
      section: 'basics',
      done: filled(input.location),
    },
    {
      key: 'timezone',
      label: 'Time zone',
      section: 'basics',
      done: filled(input.timezone) && input.timezone !== 'UTC',
    },
    {
      key: 'bio',
      label: 'Short bio',
      section: 'about',
      done: filled(input.bio),
    },
    {
      key: 'skills',
      label: 'Skills',
      section: 'about',
      done: (input.skills?.length ?? 0) > 0,
    },
    {
      key: 'department',
      label: 'Department',
      section: 'work',
      done: filled(input.department),
    },
    { key: 'team', label: 'Team', section: 'work', done: filled(input.team) },
    {
      key: 'joiningDate',
      label: 'Joining date',
      section: 'work',
      done: filled(input.joiningDate),
    },
  ];
  const optional: CompletionItem[] = [
    {
      key: 'phone',
      label: 'Phone',
      section: 'about',
      done: filled(input.phone),
    },
    {
      key: 'interests',
      label: 'Interests',
      section: 'about',
      done: (input.interests?.length ?? 0) > 0,
    },
    {
      key: 'links',
      label: 'Professional links',
      section: 'about',
      done: (input.links?.length ?? 0) > 0,
    },
    {
      key: 'birthday',
      label: 'Birthday',
      section: 'privacy',
      done: input.birthMonth != null,
    },
  ];
  const counted = [...recommended, ...optional.filter((o) => o.done)];
  const done = counted.filter((i) => i.done).length;
  const percent = Math.round((done / counted.length) * 100);
  const items = [...recommended, ...optional];
  return { percent, items, missing: items.filter((i) => !i.done) };
}

// --- wire types ---------------------------------------------------------------

export interface EmployeeLink {
  label: string;
  url: string;
}

/** What a viewer is allowed to see of one employee. Absent = not permitted. */
export interface EmployeeCard {
  userId: string;
  name: string;
  preferredName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  team: string | null;
  location: string | null;
  timezone: string | null;
  email: string | null;
  skills: string[];
  bio: string | null;
  phone?: string | null;
  links?: EmployeeLink[];
  interests?: string[];
  joiningDate?: string | null;
  yearsOfService?: number | null;
  birthday?: { month: number; day: number; year?: number } | null;
  hasLeft: boolean;
  isSelf: boolean;
}

export interface EmployeeProfileView extends EmployeeCard {
  privacy?: EmployeePrivacy;
  celebrationPrefs?: CelebrationPrefs;
  /** What the viewer may edit on this profile. */
  editable: { self: boolean; hr: boolean };
  completion?: {
    percent: number;
    items: CompletionItem[];
    missing: CompletionItem[];
  };
}

/** A birthday or work anniversary coming up for one person, as one viewer sees it. */
export interface UpcomingCelebration {
  kind: 'BIRTHDAY' | 'ANNIVERSARY';
  date: YMD;
  daysUntil: number;
  /** Anniversary number; null for birthdays. */
  years: number | null;
  isMilestone: boolean;
}

/**
 * The next birthday and work anniversary of an employee card, within
 * `withinDays` of `today`. Works off the card itself, so it can only ever
 * surface what the API already let this viewer see.
 */
export function upcomingCelebrations(
  card: {
    birthday?: { month: number; day: number } | null;
    joiningDate?: string | null;
    hasLeft?: boolean;
  },
  today: YMD,
  withinDays = 366,
): UpcomingCelebration[] {
  if (card.hasLeft) return [];
  const out: UpcomingCelebration[] = [];
  if (card.birthday) {
    const date = nextOccurrence(card.birthday.month, card.birthday.day, today);
    const daysUntil = diffDays(today, date);
    if (daysUntil <= withinDays) {
      out.push({ kind: 'BIRTHDAY', date, daysUntil, years: null, isMilestone: false });
    }
  }
  const joined = card.joiningDate ? parseYMD(card.joiningDate) : null;
  if (joined) {
    const a = nextAnniversary(joined, today);
    if (a.daysUntil <= withinDays) {
      out.push({
        kind: 'ANNIVERSARY',
        date: a.date,
        daysUntil: a.daysUntil,
        years: a.years,
        isMilestone: a.isMilestone,
      });
    }
  }
  return out.sort((x, y) => x.daysUntil - y.daysUntil);
}

/** "today", "tomorrow", "in 5 days". */
export function describeDaysUntil(days: number): string {
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

export interface EmployeeDirectoryPage {
  items: EmployeeCard[];
  total: number;
  page: number;
  pageSize: number;
  facets: { departments: string[]; teams: string[]; locations: string[] };
}
