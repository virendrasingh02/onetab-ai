import { userApi } from '@org/api-client';
import { useAuthStore, useCurrentUser } from '@org/auth';
import { useTranslation, type SupportedLanguageCode } from '@org/i18n';
import type {
  CurrentUser,
  DateFormatPreference,
  TimeFormatPreference,
} from '@org/types';
import {
  Button,
  LanguageSelect,
  LocalTime,
  RegionSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsBadge,
  SettingsCard,
  SettingsGroup,
  SettingsRow,
  SettingsSectionHeader,
  TimezoneSelect,
  toast,
} from '@org/ui';
import {
  cn,
  describeTimezone,
  formatWorkingSchedule,
  getRegionForTimezone,
  getScheduleStatus,
  getSystemTimezone,
  resolveWorkingSchedule,
  type RegionInfo,
} from '@org/utils';
import type { UpdateProfileInput } from '@org/validation';
import { useMutation } from '@tanstack/react-query';
import { Calendar, Clock, Globe, Languages, MapPin } from 'lucide-react';

/** Monday-first, the order most of the world reads a week in. */
const WEEKDAYS = [
  { day: 1, short: 'Mon' },
  { day: 2, short: 'Tue' },
  { day: 3, short: 'Wed' },
  { day: 4, short: 'Thu' },
  { day: 5, short: 'Fri' },
  { day: 6, short: 'Sat' },
  { day: 0, short: 'Sun' },
] as const;

/** Every half hour of the day as "HH:MM". */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  return `${h}:${i % 2 ? '30' : '00'}`;
});

const AUTO = 'auto';

function clockLabel(hhmm: string, timeFormat: TimeFormatPreference | null | undefined, locale: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const date = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeFormat ? { hour12: timeFormat === '12h' } : {}),
  }).format(date);
}

/**
 * Settings → Language & Region.
 *
 * Everything here is the user's own and lives on their account (not the
 * workspace), so it follows them across workspaces and devices: interface
 * language, timezone, clock/date display, and working hours. Working hours and
 * timezone are public — teammates' profile cards read them to say whether
 * this person is at their desk. Each control saves as soon as it changes.
 */
export function LanguageRegionSettings() {
  const user = useCurrentUser();
  const setUser = useAuthStore((s) => s.setUser);
  const { t, locale, setLocale, formatters, isRtl, language } = useTranslation();
  const systemTimezone = getSystemTimezone();

  const save = useMutation({
    mutationFn: (patch: Omit<UpdateProfileInput, 'name'>) =>
      userApi.updateProfile({ name: user?.name ?? '', ...patch }),
    onSuccess: (updated: CurrentUser) => setUser(updated),
    onError: () => toast.error('Could not save that change. Please try again.'),
  });

  if (!user) return null;

  // While a save is in flight show what was picked, not the stale stored value.
  const pending = (save.isPending ? save.variables : undefined) ?? {};
  const timezone = pending.timezone ?? user.timezone ?? systemTimezone;
  const timeFormat =
    pending.timeFormat !== undefined ? pending.timeFormat : (user.timeFormat ?? null);
  const dateFormat =
    pending.dateFormat !== undefined ? pending.dateFormat : (user.dateFormat ?? null);
  const schedule = resolveWorkingSchedule({
    workingHoursStart: pending.workingHoursStart ?? user.workingHoursStart,
    workingHoursEnd: pending.workingHoursEnd ?? user.workingHoursEnd,
    workingDays: pending.workingDays ?? user.workingDays,
  });

  const region = getRegionForTimezone(timezone);
  const status = getScheduleStatus(timezone, schedule);
  const sameDay = schedule.start === schedule.end;

  const handleLanguageChange = async (next: SupportedLanguageCode) => {
    setLocale(next);
    try {
      await userApi.updateLanguage({ language: next });
      setUser({ ...user, preferredLanguage: next });
      toast.success(t('settings.language_changed_success'));
    } catch {
      toast.error(t('settings.language_change_error'));
    }
  };

  const toggleDay = (day: number) => {
    const days = schedule.days.includes(day)
      ? schedule.days.filter((d) => d !== day)
      : [...schedule.days, day];
    save.mutate({ workingDays: days });
  };

  const clock = (hhmm: string) => clockLabel(hhmm, timeFormat, locale);

  return (
    <div className="space-y-8">
      <SettingsSectionHeader
        title={t('settings.languageAndRegion', 'Language & Region')}
        description="Your language, timezone, clock format and working hours. These belong to your account and apply in every workspace."
        badge={
          save.isPending ? (
            <SettingsBadge tone="neutral">Saving…</SettingsBadge>
          ) : save.isSuccess ? (
            <SettingsBadge tone="success">Saved</SettingsBadge>
          ) : null
        }
      />

      <SettingsGroup title="Language">
        <SettingsCard divided>
          <SettingsRow
            icon={<Languages />}
            title={t('settings.language', 'Language')}
            description="Used for menus, messages and number formatting."
          >
            <div className="w-56">
              <LanguageSelect value={locale} onChange={handleLanguageChange} />
            </div>
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Timezone"
        description="Shown to teammates on your profile, and used for quiet hours and reminders."
      >
        <SettingsCard>
          <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                <MapPin className="size-3.5 text-muted-foreground" />
                Region
              </label>
              <RegionSelect
                value={region.code}
                onChange={(next: RegionInfo) =>
                  save.mutate({ timezone: next.defaultTimezone })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                <Globe className="size-3.5 text-muted-foreground" />
                Timezone
              </label>
              <TimezoneSelect
                value={timezone}
                onChange={(next) => save.mutate({ timezone: next })}
              />
            </div>
          </div>

          <div className="p-4 gap-4 flex flex-wrap items-center justify-between rounded-xl border border-border bg-surface-inset">
            <div className="gap-3 min-w-0 flex items-center">
              <span className="text-3xl leading-none">{region.flag}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {region.name}{' '}
                  <span className="font-mono text-[11px] font-normal text-muted-foreground">
                    {describeTimezone(timezone)}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {timezone === systemTimezone
                    ? 'Matches this device'
                    : `This device is on ${describeTimezone(systemTimezone)}`}
                </p>
              </div>
            </div>
            <div className="gap-3 flex items-center">
              {timezone !== systemTimezone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => save.mutate({ timezone: systemTimezone })}
                >
                  Use device timezone
                </Button>
              )}
              <LocalTime
                timezone={timezone}
                showOffset
                className="font-bold text-base font-mono text-foreground"
              />
            </div>
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Date & time display">
        <SettingsCard divided>
          <SettingsRow
            icon={<Clock />}
            title="Clock"
            description={`Now: ${formatters.formatTime(new Date())}`}
          >
            <Select
              value={timeFormat ?? AUTO}
              onValueChange={(v) =>
                save.mutate({ timeFormat: v === AUTO ? null : (v as TimeFormatPreference) })
              }
            >
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO} className="text-xs">
                  Match language
                </SelectItem>
                <SelectItem value="12h" className="text-xs">
                  12-hour (2:30 PM)
                </SelectItem>
                <SelectItem value="24h" className="text-xs">
                  24-hour (14:30)
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            icon={<Calendar />}
            title="Date order"
            description={`Today: ${formatters.formatDate(new Date())}`}
          >
            <Select
              value={dateFormat ?? AUTO}
              onValueChange={(v) =>
                save.mutate({ dateFormat: v === AUTO ? null : (v as DateFormatPreference) })
              }
            >
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO} className="text-xs">
                  Match language
                </SelectItem>
                <SelectItem value="MM/DD/YYYY" className="text-xs">
                  MM/DD/YYYY
                </SelectItem>
                <SelectItem value="DD/MM/YYYY" className="text-xs">
                  DD/MM/YYYY
                </SelectItem>
                <SelectItem value="YYYY-MM-DD" className="text-xs">
                  YYYY-MM-DD
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Working hours"
        description="Teammates see these on your profile card, in your timezone."
        action={
          <SettingsBadge tone={status.status === 'working' ? 'success' : 'neutral'}>
            {status.icon} {status.status === 'working' ? 'Working now' : status.label}
          </SettingsBadge>
        }
      >
        <SettingsCard>
          <div className="gap-3 flex flex-wrap items-center">
            <Select
              value={schedule.start}
              onValueChange={(v) => save.mutate({ workingHoursStart: v })}
            >
              <SelectTrigger className="w-32 h-9 text-xs" aria-label="Start time">
                <SelectValue>{clock(schedule.start)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {HALF_HOURS.map((hhmm) => (
                  <SelectItem key={hhmm} value={hhmm} className="text-xs">
                    {clock(hhmm)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">to</span>
            <Select
              value={schedule.end}
              onValueChange={(v) => save.mutate({ workingHoursEnd: v })}
            >
              <SelectTrigger className="w-32 h-9 text-xs" aria-label="End time">
                <SelectValue>{clock(schedule.end)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {HALF_HOURS.map((hhmm) => (
                  <SelectItem key={hhmm} value={hhmm} className="text-xs">
                    {clock(hhmm)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {schedule.start > schedule.end && (
              <span className="text-[11px] text-muted-foreground">Ends the next day</span>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Working days</p>
            <div className="gap-1.5 flex flex-wrap" role="group" aria-label="Working days">
              {WEEKDAYS.map(({ day, short }) => {
                const on = schedule.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'h-9 w-12 text-xs font-medium rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </div>

          <p
            className={cn(
              'text-xs',
              sameDay || schedule.days.length === 0
                ? 'text-warning-text'
                : 'text-muted-foreground',
            )}
          >
            {sameDay
              ? 'Start and end are the same time, so you will never show as working.'
              : schedule.days.length === 0
                ? 'No working days selected, so you will always show as off.'
                : `Shown to teammates as: ${formatWorkingSchedule({
                    ...schedule,
                    start: clock(schedule.start),
                    end: clock(schedule.end),
                  })}`}
          </p>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Formatting preview"
        description={`How ${language.name} (${language.nativeName}) formats things, with your choices applied.`}
      >
        <SettingsCard>
          <dl className="sm:grid-cols-2 lg:grid-cols-3 gap-3 grid grid-cols-1">
            {[
              ['Full date', formatters.formatDate(new Date(), { dateStyle: 'full' })],
              ['Date & time', formatters.formatDateTime(new Date())],
              ['Relative', formatters.formatRelative(new Date(Date.now() - 3_600_000))],
              ['Number', formatters.formatNumber(1234567.89)],
              ['Currency', formatters.formatCurrency(129.99, region.currency)],
              ['Percent', formatters.formatPercent(0.854)],
            ].map(([label, value]) => (
              <div key={label} className="p-3 space-y-1 rounded-lg border border-border bg-surface-inset">
                <dt className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {label}
                </dt>
                <dd className="text-xs font-mono font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {isRtl && (
            <p className="p-3 text-xs rounded-lg border border-warning/30 bg-warning/10 text-warning-text">
              This language is written right-to-left, so the whole interface is mirrored.
            </p>
          )}
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
