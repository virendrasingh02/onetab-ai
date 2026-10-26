import { useCurrentUser } from '@org/auth';
import {
  CELEBRATION_LEAD_DAYS,
  REMINDER_INTERVAL_DAYS,
  type CelebrationPrefs,
  type EmployeePrivacy,
  type EmployeeProfileView,
  type PeopleVisibility,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PhoneInput,
  Progress,
  SettingsCard,
  SettingsGroup,
  SettingsRow,
  Skeleton,
  Switch,
  toast,
} from '@org/ui';
import type { UpdateCelebrationPrefsInput } from '@org/validation';
import { isValidPhone } from '@org/utils';
import {
  MONTHS,
  errorMessage,
  formatDate,
  useCurrentWorkspace,
  useEmployeeProfile,
  usePeopleMutations,
} from '@org/web-workspace';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Circle, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

/** Completion items stored on the account profile (Settings → Profile). */
const ACCOUNT_FIELD_KEYS = new Set([
  'avatar',
  'name',
  'jobTitle',
  'location',
  'timezone',
  'bio',
]);
/** Completion items set by HR on the Employment card. */
const HR_FIELD_KEYS = new Set(['department', 'team', 'joiningDate']);

const ANCHOR = {
  contact: 'work-profile-contact',
  privacy: 'work-profile-privacy',
} as const;

const VISIBILITY_OPTIONS: { value: PeopleVisibility; label: string }[] = [
  { value: 'PRIVATE', label: 'Only me' },
  { value: 'TEAM', label: 'My team' },
  { value: 'WORKSPACE', label: 'Everyone in the workspace' },
];

const isHttpUrl = (v: string) => {
  try {
    const { protocol } = new URL(v.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

/** Row-level problem with a professional link, or undefined when fine / blank. */
const linkError = (l: { label: string; url: string }) => {
  const label = l.label.trim();
  const url = l.url.trim();
  if (!label && !url) return undefined;
  if (!label) return 'Add a label';
  if (!url) return 'Add a URL';
  return isHttpUrl(url) ? undefined : 'Use a full http(s) link';
};

const scrollTo = (id: string) =>
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * Settings → Profile → "Work & privacy": the one place an employee edits their own
 * employee-specific details — contact, skills, links, birthday, privacy and
 * celebration notifications. Name, photo, title, location, time zone and bio
 * stay in the Profile view's Account tab; this panel links there rather than repeating them.
 */
export function EmployeeSettingsPanel() {
  const { workspaceId, workspace } = useCurrentWorkspace();
  const me = useCurrentUser();
  const { data, isLoading, isError, refetch } = useEmployeeProfile(
    workspaceId,
    me?.id,
  );

  if (isLoading)
    return <Skeleton className="h-96 w-full rounded-xl" aria-busy="true" />;
  if (isError || !data) {
    return (
      <EmptyState
        icon={<UserRound />}
        title="Couldn't load your work profile"
        description="Something went wrong fetching your details."
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  return (
    <div className="space-y-8">
      <CompletionSection data={data} workspaceSlug={workspace?.slug} />
      <ContactSection key={`c-${data.userId}`} data={data} />
      <EmploymentSection data={data} />
      {data.privacy && data.celebrationPrefs && (
        <PrivacySection key={`p-${data.userId}`} data={data} />
      )}
    </div>
  );
}

// --- completion --------------------------------------------------------------------

function CompletionSection({
  data,
  workspaceSlug,
}: {
  data: EmployeeProfileView;
  workspaceSlug?: string;
}) {
  const completion = data.completion;
  if (!completion) return null;
  const profileHref = workspaceSlug
    ? `/w/${workspaceSlug}/settings/profile`
    : undefined; // Account view

  return (
    <SettingsGroup
      title="Profile completion"
      action={
        <span className="text-sm font-semibold tabular-nums">
          {completion.percent}%
        </span>
      }
    >
      <SettingsCard>
        <Progress value={completion.percent} label="Profile completion" />
        {completion.missing.length === 0 ? (
          <p className="gap-1.5 text-sm flex items-center text-success-text">
            <CheckCircle2 className="size-4" aria-hidden /> Your profile is
            complete.
          </p>
        ) : (
          <ul className="gap-x-6 gap-y-1 sm:grid-cols-2 grid">
            {completion.items.map((item) => {
              if (item.done) {
                return (
                  <li
                    key={item.key}
                    className="gap-2 py-1 text-sm flex items-center text-muted-foreground"
                  >
                    <CheckCircle2
                      className="size-4 text-success-text"
                      aria-hidden
                    />{' '}
                    {item.label}
                  </li>
                );
              }
              const label = (
                <>
                  <Circle
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />{' '}
                  {item.label}
                  <span className="text-xs ml-auto text-muted-foreground">
                    {HR_FIELD_KEYS.has(item.key) ? 'Set by HR' : 'Add'}
                  </span>
                </>
              );
              const rowClass =
                'gap-2 py-1 flex w-full items-center text-left text-sm';
              return (
                <li key={item.key}>
                  {HR_FIELD_KEYS.has(item.key) ? (
                    <span className={rowClass}>{label}</span>
                  ) : ACCOUNT_FIELD_KEYS.has(item.key) && profileHref ? (
                    <Link
                      to={profileHref}
                      className={`${rowClass} hover:text-primary-text`}
                    >
                      {label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`${rowClass} cursor-pointer hover:text-primary-text`}
                      onClick={() =>
                        scrollTo(
                          item.section === 'privacy'
                            ? ANCHOR.privacy
                            : ANCHOR.contact,
                        )
                      }
                    >
                      {label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
    </SettingsGroup>
  );
}

// --- contact, skills, links ---------------------------------------------------------

function SaveRow({
  pending,
  dirty,
  label = 'Save changes',
}: {
  pending: boolean;
  dirty: boolean;
  label?: string;
}) {
  return (
    <div className="flex justify-end">
      <Button type="submit" loading={pending} disabled={!dirty || pending}>
        {label}
      </Button>
    </div>
  );
}

function TagField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (
      v &&
      !values.some((x) => x.toLowerCase() === v.toLowerCase()) &&
      values.length < 30
    )
      onChange([...values, v]);
    setDraft('');
  };
  return (
    <Field label={label} optional>
      <div className="gap-2 flex flex-col">
        <div className="gap-2 flex">
          <Input
            value={draft}
            maxLength={40}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={!draft.trim()}
          >
            Add
          </Button>
        </div>
        {values.length > 0 && (
          <ul className="gap-1.5 flex flex-wrap">
            {values.map((v) => (
              <li key={v}>
                <Badge variant="neutral" className="gap-1">
                  {v}
                  <button
                    type="button"
                    aria-label={`Remove ${v}`}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => onChange(values.filter((x) => x !== v))}
                  >
                    ×
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

function ContactSection({ data }: { data: EmployeeProfileView }) {
  const { workspaceId } = useCurrentWorkspace();
  const { updateProfile } = usePeopleMutations(workspaceId);
  const [preferredName, setPreferredName] = useState(data.preferredName ?? '');
  const [phone, setPhone] = useState(data.phone ?? '');
  const [skills, setSkills] = useState(data.skills);
  const [interests, setInterests] = useState(data.interests ?? []);
  const [links, setLinks] = useState(data.links ?? []);
  const dirty =
    JSON.stringify([preferredName, phone, skills, interests, links]) !==
    JSON.stringify([
      data.preferredName ?? '',
      data.phone ?? '',
      data.skills,
      data.interests ?? [],
      data.links ?? [],
    ]);

  const phoneInvalid = !!phone && !isValidPhone(phone);
  const linksInvalid = links.some((l) => linkError(l));

  const submit = () =>
    !phoneInvalid &&
    !linksInvalid &&
    updateProfile.mutate(
      {
        preferredName: preferredName.trim() || null,
        phone: phone.trim() || null,
        skills,
        interests,
        links: links
          .filter((l) => l.label.trim() && l.url.trim())
          .map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      },
      {
        onSuccess: () => toast.success('Work profile saved'),
        onError: (err) =>
          toast.error(errorMessage(err, 'Could not save your work profile')),
      },
    );

  return (
    <SettingsGroup
      id={ANCHOR.contact}
      title="About & contact"
      description="Shown on your profile only as your privacy settings below allow."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <SettingsCard>
          <div className="gap-4 sm:grid-cols-2 grid">
            <Field
              label="Preferred name"
              optional
              hint="What teammates should call you."
            >
              <Input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                maxLength={80}
              />
            </Field>
            <Field
              label="Phone"
              optional
              hint="Include the country code."
              error={
                phoneInvalid
                  ? 'Enter a valid phone number for the selected country.'
                  : undefined
              }
            >
              <PhoneInput
                value={phone}
                onChange={setPhone}
                invalid={phoneInvalid}
              />
            </Field>
          </div>
          <TagField
            label="Skills"
            values={skills}
            onChange={setSkills}
            placeholder="e.g. TypeScript — press Enter"
          />
          <TagField
            label="Interests"
            values={interests}
            onChange={setInterests}
            placeholder="e.g. Climbing"
          />
          <Field
            label="Professional links"
            optional
            hint="http(s) links only, up to 10."
          >
            <div className="gap-2 flex flex-col">
              {links.map((l, i) => (
                <div key={i} className="gap-1 flex flex-col">
                  <div className="gap-2 flex">
                    <Input
                      aria-label="Link label"
                      className="w-36"
                      placeholder="Label"
                      value={l.label}
                      maxLength={40}
                      onChange={(e) =>
                        setLinks(
                          links.map((x, j) =>
                            j === i ? { ...x, label: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Input
                      aria-label="Link URL"
                      placeholder="https://…"
                      value={l.url}
                      maxLength={500}
                      onChange={(e) =>
                        setLinks(
                          links.map((x, j) =>
                            j === i ? { ...x, url: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Remove link"
                      onClick={() => setLinks(links.filter((_, j) => j !== i))}
                    >
                      ×
                    </Button>
                  </div>
                  {linkError(l) && (
                    <p role="alert" className="text-xs text-destructive-text">
                      {linkError(l)}
                    </p>
                  )}
                </div>
              ))}
              {links.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setLinks([...links, { label: '', url: '' }])}
                >
                  Add link
                </Button>
              )}
            </div>
          </Field>
          <SaveRow
            pending={updateProfile.isPending}
            dirty={dirty && !phoneInvalid && !linksInvalid}
          />
        </SettingsCard>
      </form>
    </SettingsGroup>
  );
}

// --- employment (read-only) ----------------------------------------------------------

function EmploymentSection({ data }: { data: EmployeeProfileView }) {
  return (
    <SettingsGroup
      title="Employment"
      description="Managed by HR. Ask a workspace admin if something is wrong."
    >
      <SettingsCard divided>
        <SettingsRow title="Department">{data.department ?? '—'}</SettingsRow>
        <SettingsRow title="Team">{data.team ?? '—'}</SettingsRow>
        <SettingsRow
          title="Joining date"
          description="Drives your work anniversary."
        >
          {data.joiningDate ? formatDate(data.joiningDate) : '—'}
        </SettingsRow>
      </SettingsCard>
    </SettingsGroup>
  );
}

// --- privacy + notifications ----------------------------------------------------------

function PrivacySection({ data }: { data: EmployeeProfileView }) {
  const { workspaceId } = useCurrentWorkspace();
  const { updateProfile, updatePrivacy, updateCelebrations } =
    usePeopleMutations(workspaceId);
  // The API only sends these to the owner, and this panel is only the owner's.
  const initialPrivacy = data.privacy as EmployeePrivacy;
  const initialPrefs = data.celebrationPrefs as CelebrationPrefs;
  const [month, setMonth] = useState(
    data.birthday ? String(data.birthday.month) : '',
  );
  const [day, setDay] = useState(
    data.birthday ? String(data.birthday.day) : '',
  );
  const [year, setYear] = useState(
    data.birthday?.year ? String(data.birthday.year) : '',
  );
  const [privacy, setPrivacy] = useState<EmployeePrivacy>(initialPrivacy);
  const [prefs, setPrefs] = useState<CelebrationPrefs>(initialPrefs);

  const birthdayChanged =
    JSON.stringify([month, day, year]) !==
    JSON.stringify([
      data.birthday ? String(data.birthday.month) : '',
      data.birthday ? String(data.birthday.day) : '',
      data.birthday?.year ? String(data.birthday.year) : '',
    ]);
  const privacyChanged =
    JSON.stringify(privacy) !== JSON.stringify(initialPrivacy);
  const prefsChanged = JSON.stringify(prefs) !== JSON.stringify(initialPrefs);
  const dirty = birthdayChanged || privacyChanged || prefsChanged;

  // 2024 is a leap year, so 29 Feb stays allowed.
  const maxDay = month ? new Date(2024, Number(month), 0).getDate() : 31;
  const dayError =
    month && !day
      ? 'Add the day, or set the month to "Not set".'
      : day && !month
        ? 'Choose a month.'
        : day &&
            (!Number.isInteger(Number(day)) ||
              Number(day) < 1 ||
              Number(day) > maxDay)
          ? `Enter a day between 1 and ${maxDay}.`
          : undefined;
  const yearError =
    year && !month
      ? 'Set a birthday first.'
      : year &&
          (!Number.isInteger(Number(year)) ||
            Number(year) < 1900 ||
            Number(year) > new Date().getFullYear())
        ? 'Enter a valid year.'
        : undefined;
  const invalid = !!dayError || !!yearError;

  const save = useMutation({
    mutationFn: async () => {
      if (birthdayChanged)
        await updateProfile.mutateAsync(
          month && day
            ? {
                birthMonth: Number(month),
                birthDay: Number(day),
                birthYear: year ? Number(year) : null,
              }
            : { birthMonth: null },
        );
      if (privacyChanged) await updatePrivacy.mutateAsync(privacy);
      if (prefsChanged)
        await updateCelebrations.mutateAsync(
          prefs as UpdateCelebrationPrefsInput,
        );
    },
    onSuccess: () => toast.success('Privacy & notification settings saved'),
    onError: (err) => toast.error(errorMessage(err, 'Could not save settings')),
  });

  const visibility = (key: 'birthday' | 'anniversary' | 'contact') => (
    <AppSelect
      aria-label="Visibility"
      className="w-56"
      value={privacy[key]}
      onValueChange={(v) =>
        setPrivacy({ ...privacy, [key]: v as PeopleVisibility })
      }
      options={VISIBILITY_OPTIONS}
    />
  );

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && !invalid) save.mutate();
      }}
    >
      <SettingsGroup
        id={ANCHOR.privacy}
        title="Birthday"
        description="Optional. Private by default — it is only shown or celebrated for the audience you pick."
      >
        <SettingsCard>
          <div className="gap-4 sm:grid-cols-3 grid">
            <Field label="Month" optional>
              <AppSelect
                value={month}
                onValueChange={setMonth}
                placeholder="Month"
                options={[
                  { value: '', label: 'Not set' },
                  ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
                ]}
              />
            </Field>
            <Field label="Day" optional error={dayError}>
              <Input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </Field>
            <Field label="Year" optional error={yearError}>
              <Input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </Field>
          </div>
        </SettingsCard>
        <SettingsCard divided>
          <SettingsRow
            title="Who can see my birthday"
            description="Also decides who is notified."
          >
            {visibility('birthday')}
          </SettingsRow>
          <SettingsRow
            title="Hide my birth year"
            description="Others see only the day and month."
          >
            <Switch
              aria-label="Hide my birth year"
              checked={privacy.hideBirthYear}
              onCheckedChange={(v) =>
                setPrivacy({ ...privacy, hideBirthYear: v })
              }
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="What others can see">
        <SettingsCard divided>
          <SettingsRow
            title="Work anniversary"
            description="Your joining date is set by HR; this controls who sees it."
          >
            {visibility('anniversary')}
          </SettingsRow>
          <SettingsRow
            title="Phone, links & interests"
            description="Your work email is always visible to workspace members."
          >
            {visibility('contact')}
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title="Celebration notifications"
        description="Delivered at 09:00 in your time zone."
      >
        <SettingsCard divided>
          <SettingsRow
            title="Birthdays"
            description="Notify me about teammates’ birthdays."
          >
            <Switch
              aria-label="Birthday notifications"
              checked={prefs.birthdays}
              onCheckedChange={(v) => setPrefs({ ...prefs, birthdays: v })}
            />
          </SettingsRow>
          <SettingsRow
            title="Work anniversaries"
            description="Notify me about teammates’ work anniversaries."
          >
            <Switch
              aria-label="Anniversary notifications"
              checked={prefs.anniversaries}
              onCheckedChange={(v) => setPrefs({ ...prefs, anniversaries: v })}
            />
          </SettingsRow>
          <SettingsRow title="When" description="How early to notify me.">
            <AppSelect
              aria-label="Notify when"
              className="w-44"
              value={String(prefs.daysBefore)}
              onValueChange={(v) =>
                setPrefs({ ...prefs, daysBefore: Number(v) })
              }
              options={CELEBRATION_LEAD_DAYS.map((d) => ({
                value: String(d),
                label:
                  d === 0
                    ? 'On the day'
                    : d === 1
                      ? '1 day before'
                      : `${d} days before`,
              }))}
            />
          </SettingsRow>
          <SettingsRow
            title="Profile reminders"
            description="Remind me to finish my profile."
          >
            <Switch
              aria-label="Profile reminders"
              checked={prefs.profileReminders}
              onCheckedChange={(v) =>
                setPrefs({ ...prefs, profileReminders: v })
              }
            />
          </SettingsRow>
          {prefs.profileReminders && (
            <SettingsRow nested title="Remind me at most every">
              <AppSelect
                aria-label="Reminder interval"
                className="w-36"
                value={String(prefs.reminderEveryDays)}
                onValueChange={(v) =>
                  setPrefs({ ...prefs, reminderEveryDays: Number(v) })
                }
                options={REMINDER_INTERVAL_DAYS.map((d) => ({
                  value: String(d),
                  label: `${d} days`,
                }))}
              />
            </SettingsRow>
          )}
        </SettingsCard>
      </SettingsGroup>

      <SaveRow
        pending={save.isPending}
        dirty={dirty && !invalid}
        label="Save privacy & notifications"
      />
    </form>
  );
}
