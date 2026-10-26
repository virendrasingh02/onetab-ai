import {
  canSeeWith,
  computeProfileCompletion,
  diffDays,
  formatYMD,
  nextAnniversary,
  nextOccurrence,
  sameTeam,
  todayInZone,
  type CelebrationPrefs,
  type EmployeePrivacy,
  type YMD,
} from '@org/types';

/** Local hour at which a recipient's celebration notifications start going out. */
export const NOTIFY_FROM_HOUR = 9;

export interface PlannerSubject {
  userId: string;
  name: string;
  team: string | null;
  privacy: EmployeePrivacy;
  birthMonth: number | null;
  birthDay: number | null;
  joiningDate: YMD | null;
  hasLeft: boolean;
}

export interface PlannerRecipient {
  userId: string;
  timezone: string;
  team: string | null;
  prefs: CelebrationPrefs;
  /** Recipient opted out of everything but mentions in this workspace. */
  mentionsOnly: boolean;
}

export interface PlannedDispatch {
  /** Deterministic idempotency key: the same event never yields two. */
  key: string;
  kind: 'BIRTHDAY' | 'ANNIVERSARY';
  subjectId: string;
  recipientId: string;
  title: string;
  body: string;
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

function leadPhrase(lead: number): string {
  return lead === 0 ? 'today' : lead === 1 ? 'tomorrow' : `in ${lead} days`;
}

/**
 * Which celebration notifications are due right now.
 *
 * Each recipient is judged on their *own* calendar: it is due when the
 * recipient's local date is exactly `daysBefore` days before the event and it
 * is past 09:00 for them. Because the condition holds all day, a missed cron
 * tick is caught by the next one, and the dispatch key (which carries the
 * occurrence date) makes the repeat a no-op. Nothing private leaks: the text
 * carries a first name and, for anniversaries the subject chose to share, the
 * year count — never a birth year or age.
 */
export function planCelebrations(
  workspaceId: string,
  now: Date,
  subjects: readonly PlannerSubject[],
  recipients: readonly PlannerRecipient[],
): PlannedDispatch[] {
  const out: PlannedDispatch[] = [];

  for (const r of recipients) {
    if (r.mentionsOnly) continue;
    const today = todayInZone(now, r.timezone);
    if (today.hour < NOTIFY_FROM_HOUR) continue;
    const lead = r.prefs.daysBefore;

    for (const s of subjects) {
      if (s.userId === r.userId || s.hasLeft) continue;
      const rel = { isSelf: false, sameTeam: sameTeam(s.team, r.team) };

      if (r.prefs.birthdays && s.birthMonth != null && s.birthDay != null) {
        if (canSeeWith(s.privacy.birthday, rel)) {
          const occ = nextOccurrence(s.birthMonth, s.birthDay, today);
          if (diffDays(today, occ) === lead) {
            out.push({
              key: `birthday:${workspaceId}:${s.userId}:${r.userId}:${formatYMD(occ)}`,
              kind: 'BIRTHDAY',
              subjectId: s.userId,
              recipientId: r.userId,
              title: `${firstName(s.name)}'s birthday is ${leadPhrase(lead)}`,
              body: 'Send them a note to celebrate.',
            });
          }
        }
      }

      if (
        r.prefs.anniversaries &&
        s.joiningDate &&
        canSeeWith(s.privacy.anniversary, rel)
      ) {
        const a = nextAnniversary(s.joiningDate, today);
        if (a.daysUntil === lead) {
          const yrs = `${a.years} ${a.years === 1 ? 'year' : 'years'}`;
          out.push({
            key: `anniversary:${workspaceId}:${s.userId}:${r.userId}:${formatYMD(a.date)}`,
            kind: 'ANNIVERSARY',
            subjectId: s.userId,
            recipientId: r.userId,
            title: `${firstName(s.name)} reaches ${yrs} at the company ${leadPhrase(lead)}`,
            body: a.isMilestone
              ? 'A milestone work anniversary — worth celebrating.'
              : 'Congratulate them on the work anniversary.',
          });
        }
      }
    }
  }
  return out;
}

export interface ReminderCandidate {
  userId: string;
  timezone: string;
  prefs: CelebrationPrefs;
  mentionsOnly: boolean;
  /** Employee-editable recommended fields, as the completion input. */
  completion: Parameters<typeof computeProfileCompletion>[0];
}

export interface PlannedReminder {
  key: string;
  recipientId: string;
  missing: string[];
  title: string;
  body: string;
}

/** Employee-editable recommended items; HR-managed ones are not nagged. */
const EMPLOYEE_EDITABLE_KEYS = new Set([
  'avatar',
  'name',
  'jobTitle',
  'location',
  'timezone',
  'bio',
  'skills',
]);

/**
 * Profile-completion reminders. The key buckets time into windows of the
 * recipient's `reminderEveryDays`, so within a window the reminder is sent at
 * most once, and it stops entirely as soon as nothing editable is missing.
 */
export function planProfileReminders(
  workspaceId: string,
  now: Date,
  candidates: readonly ReminderCandidate[],
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const c of candidates) {
    if (!c.prefs.profileReminders || c.mentionsOnly) continue;
    const today = todayInZone(now, c.timezone);
    if (today.hour < NOTIFY_FROM_HOUR) continue;

    const missing = computeProfileCompletion(c.completion).missing.filter((m) =>
      EMPLOYEE_EDITABLE_KEYS.has(m.key),
    );
    if (missing.length === 0) continue;

    const dayNo = diffDays({ y: 1970, m: 1, d: 1 }, today);
    const bucket = Math.floor(dayNo / c.prefs.reminderEveryDays);
    out.push({
      key: `profile-reminder:${workspaceId}:${c.userId}:${c.prefs.reminderEveryDays}:${bucket}`,
      recipientId: c.userId,
      missing: missing.map((m) => m.key),
      title: 'Finish your profile',
      body: `Still missing: ${missing
        .slice(0, 4)
        .map((m) => m.label.toLowerCase())
        .join(', ')}${missing.length > 4 ? '…' : ''}.`,
    });
  }
  return out;
}
