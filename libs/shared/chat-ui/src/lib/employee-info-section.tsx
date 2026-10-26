import {
  describeDaysUntil,
  todayInZone,
  upcomingCelebrations,
  type UpcomingCelebration,
} from '@org/types';
import { Badge, Button } from '@org/ui';
import { formatPhone } from '@org/utils';
import { Briefcase, Cake, ExternalLink, Pencil, PartyPopper, Phone, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEmployeeInfoSource, type EmployeeInfoSource } from './employee-info-context.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

function Card({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="p-3 space-y-1.5 rounded-xl border border-border bg-surface-inset/50">
      <div className="gap-1.5 font-bold tracking-wider flex items-center text-2xs text-muted-foreground uppercase">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

/** Celebrations this close to today get a highlighted card at the top of the rail. */
const CELEBRATION_HIGHLIGHT_DAYS = 30;

function celebrationText(c: UpcomingCelebration): string {
  if (c.kind === 'BIRTHDAY') {
    return c.daysUntil === 0 ? 'Birthday today 🎂' : `Birthday ${describeDaysUntil(c.daysUntil)}`;
  }
  const yrs = `${c.years}-year work anniversary`;
  return c.daysUntil === 0 ? `${yrs} today 🎉` : `${yrs} ${describeDaysUntil(c.daysUntil)}`;
}

const shortDate = (c: UpcomingCelebration): string =>
  `${MONTHS[c.date.m - 1]} ${c.date.d}`;

/**
 * The employee details block of the profile rail: department, team, tenure,
 * phone, skills, links and birthday — only what the API says this viewer may
 * see (privacy is enforced server-side), so an absent field is simply not shown.
 */
export function EmployeeInfoSection({ userId }: { userId: string }) {
  const source = useEmployeeInfoSource();
  return source ? <EmployeeInfoBody userId={userId} source={source} /> : null;
}

function EmployeeInfoBody({ userId, source }: { userId: string; source: EmployeeInfoSource }) {
  const info = source.useEmployee(userId);
  if (!info) return null;

  // Computed from the card itself, so it can only show what the viewer may see.
  const celebrations = upcomingCelebrations(
    info,
    todayInZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    CELEBRATION_HIGHLIGHT_DAYS,
  );
  const birthdayNext = upcomingCelebrations(
    { birthday: info.birthday },
    todayInZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
  )[0];
  const nextAnniversary = upcomingCelebrations(
    { joiningDate: info.joiningDate, hasLeft: info.hasLeft },
    todayInZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
  )[0];

  const workLine = [info.department, info.team].filter(Boolean).join(' · ');
  const phone = formatPhone(info.phone);
  const hasWork = !!(workLine || info.joiningDate);
  const hasLinks = (info.links?.length ?? 0) > 0;
  const hasSkills = info.skills.length > 0 || (info.interests?.length ?? 0) > 0;
  const canEditHr = info.editable.hr;
  const canEditSelf = info.editable.self && !!source.onEditSelf;
  if (!hasWork && !phone && !hasLinks && !hasSkills && !info.birthday && !canEditHr && !canEditSelf) return null;

  return (
    <div className="space-y-3 text-xs">
      {celebrations.length > 0 && (
        <div className="p-3 space-y-1.5 rounded-xl border border-primary/25 bg-primary/5">
          <div className="gap-1.5 font-bold tracking-wider flex items-center text-2xs text-primary-text uppercase">
            <PartyPopper className="size-3" aria-hidden />
            <span>Celebrations</span>
          </div>
          <ul className="space-y-1">
            {celebrations.map((c) => (
              <li key={c.kind} className="gap-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{celebrationText(c)}</span>
                <span className="gap-1.5 flex shrink-0 items-center">
                  {c.isMilestone && c.kind === 'ANNIVERSARY' && (
                    <Badge variant="warning" className="text-2xs">
                      Milestone
                    </Badge>
                  )}
                  {c.daysUntil > 0 && <span className="text-muted-foreground">{shortDate(c)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(hasWork || canEditHr) && (
        <Card icon={<Briefcase className="size-3 text-primary-text" />} label="Work">
          {info.hasLeft && (
            <Badge variant="neutral" className="text-2xs">
              Left the organization
            </Badge>
          )}
          {workLine ? (
            <p className="text-xs font-semibold text-foreground">{workLine}</p>
          ) : (
            <p className="text-muted-foreground">No department or team set.</p>
          )}
          {info.joiningDate && (
            <p className="text-muted-foreground">
              Joined {formatDate(info.joiningDate)}
              {info.yearsOfService != null && info.yearsOfService > 0
                ? ` · ${info.yearsOfService} ${info.yearsOfService === 1 ? 'year' : 'years'} of service`
                : ''}
            </p>
          )}
          {nextAnniversary && (
            <p className="text-muted-foreground">
              Next anniversary: {nextAnniversary.years} {nextAnniversary.years === 1 ? 'year' : 'years'} ·{' '}
              {shortDate(nextAnniversary)} ({describeDaysUntil(nextAnniversary.daysUntil)})
            </p>
          )}
          {canEditHr && source.onEditEmployment && (
            <Button
              variant="link"
              size="xs"
              className="mt-0.5 h-auto gap-1 px-0 text-[11px]"
              onClick={() => source.onEditEmployment?.(info)}
            >
              <Pencil className="size-3" aria-hidden /> Edit employment
            </Button>
          )}
        </Card>
      )}

      {phone && (
        <Card icon={<Phone className="size-3 text-success-text" />} label="Phone">
          <a
            href={`tel:${info.phone}`}
            className="text-xs font-semibold text-foreground hover:text-primary-text"
          >
            {phone}
          </a>
        </Card>
      )}

      {hasSkills && (
        <Card icon={<Sparkles className="size-3 text-warning-text" />} label="Skills & interests">
          <div className="gap-1.5 flex flex-wrap">
            {info.skills.map((s) => (
              <Badge key={`s-${s}`} variant="primary" className="text-2xs">
                {s}
              </Badge>
            ))}
            {info.interests?.map((s) => (
              <Badge key={`i-${s}`} variant="neutral" className="text-2xs">
                {s}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {hasLinks && (
        <Card icon={<ExternalLink className="size-3 text-accent-blue" />} label="Links">
          <ul className="space-y-0.5">
            {info.links?.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary-text hover:underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {info.birthday && (
        <Card icon={<Cake className="size-3 text-accent-blue" />} label="Birthday">
          <p className="text-xs font-semibold text-foreground">
            {MONTHS[info.birthday.month - 1]} {info.birthday.day}
            {info.birthday.year ? `, ${info.birthday.year}` : ''}
          </p>
          {birthdayNext && (
            <p className="text-muted-foreground">{describeDaysUntil(birthdayNext.daysUntil)}</p>
          )}
        </Card>
      )}

      {canEditSelf && (
        <Button
          variant="link"
          size="xs"
          className="h-auto gap-1 px-0 text-[11px]"
          onClick={() => source.onEditSelf?.()}
        >
          <Pencil className="size-3" aria-hidden /> Edit work profile
        </Button>
      )}
    </div>
  );
}
