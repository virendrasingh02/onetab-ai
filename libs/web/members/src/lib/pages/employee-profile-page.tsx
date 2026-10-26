import { useCurrentUser } from '@org/auth';
import type { EmployeeProfileView } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  LocalTime,
  PageBar,
  PageTabBar,
  SettingsCard,
  SettingsGroup,
  Skeleton,
  Tabs,
  TabsTrigger,
  UserAvatar,
  toast,
} from '@org/ui';
import { formatPhone } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  ArrowLeft,
  Cake,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Settings2,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MONTHS, errorMessage, formatDate } from '../people-utils.js';
import { useEmployeeProfile, usePeopleMutations } from '../use-people.js';

type Section = 'overview' | 'work';

export function EmployeeProfilePage() {
  const { workspaceId, workspace } = useCurrentWorkspace();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { userId: param } = useParams();
  const [params, setParams] = useSearchParams();
  const targetId = param === 'me' ? me?.id : param;
  const { data, isLoading, isError, error, refetch } = useEmployeeProfile(
    workspaceId,
    targetId,
  );

  const section = (params.get('section') as Section) || 'overview';
  const goSection = (next: Section) =>
    setParams(next === 'overview' ? {} : { section: next }, { replace: true });

  if (isLoading) {
    return (
      <div className="gap-4 p-6 flex flex-col" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (isError || !data) {
    const notFound =
      (error as { response?: { status?: number } } | null)?.response?.status ===
      404;
    return (
      <EmptyState
        icon={<UserRound />}
        title={notFound ? 'Employee not found' : "Couldn't load this profile"}
        description={
          notFound
            ? 'They may not be a member of this workspace.'
            : 'Please try again.'
        }
        action={
          notFound ? (
            <Button
              variant="outline"
              onClick={() => navigate('..', { relative: 'path' })}
            >
              Back to directory
            </Button>
          ) : (
            <Button onClick={() => refetch()}>Try again</Button>
          )
        }
      />
    );
  }

  const canEditSelf = data.editable.self;
  // HR edits employment details on anyone's profile; employees edit their own
  // details in Settings → Work Profile.
  const sections: { id: Section; label: string }[] = data.editable.hr
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'work', label: 'Employment (HR)' },
      ]
    : [{ id: 'overview', label: 'Overview' }];

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <PageBar
        icon={<UserRound />}
        title={data.name}
        hasTabs={sections.length > 1}
        actions={
          <>
            {canEditSelf && workspace?.slug && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/w/${workspace.slug}/settings/profile?view=work`)
                }
              >
                <Settings2 className="size-4" aria-hidden /> Edit in Settings
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('..', { relative: 'path' })}
            >
              <ArrowLeft className="size-4" aria-hidden /> Directory
            </Button>
          </>
        }
      />
      {sections.length > 1 && (
        <Tabs value={section} onValueChange={(v) => goSection(v as Section)}>
          <PageTabBar>
            {sections.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.label}
              </TabsTrigger>
            ))}
          </PageTabBar>
        </Tabs>
      )}
      <div className="min-h-0 px-3 py-4 sm:px-6 flex-1 overflow-y-auto">
        <div className="gap-4 max-w-3xl mx-auto flex w-full flex-col">
          {section === 'overview' && <Overview data={data} />}
          {section === 'work' && data.editable.hr && (
            <WorkSection data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- overview --------------------------------------------------------------------

function Overview({ data }: { data: EmployeeProfileView }) {
  const sub = [data.jobTitle, data.department, data.team]
    .filter(Boolean)
    .join(' · ');
  const bday = data.birthday
    ? `${MONTHS[data.birthday.month - 1]} ${data.birthday.day}${data.birthday.year ? `, ${data.birthday.year}` : ''}`
    : null;
  return (
    <>
      <section className="gap-4 p-5 flex items-start rounded-xl border border-border bg-surface-raised">
        <UserAvatar
          name={data.name}
          src={data.avatarUrl}
          seed={data.userId}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="gap-2 text-lg font-semibold flex flex-wrap items-center">
            {data.name}
            {data.preferredName && (
              <span className="text-sm font-normal text-muted-foreground">
                “{data.preferredName}”
              </span>
            )}
            {data.hasLeft && (
              <Badge variant="neutral">Left the organization</Badge>
            )}
          </h2>
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
          <ul className="mt-3 gap-x-4 gap-y-1 text-sm flex flex-wrap text-muted-foreground">
            {data.email && (
              <li className="gap-1.5 flex items-center">
                <Mail className="size-3.5" aria-hidden />
                {data.email}
              </li>
            )}
            {data.phone && (
              <li className="gap-1.5 flex items-center">
                <Phone className="size-3.5" aria-hidden />
                {formatPhone(data.phone)}
              </li>
            )}
            {data.location && (
              <li className="gap-1.5 flex items-center">
                <MapPin className="size-3.5" aria-hidden />
                {data.location}
              </li>
            )}
            {data.timezone && (
              <li>
                <LocalTime timezone={data.timezone} icon showOffset />
              </li>
            )}
          </ul>
        </div>
      </section>

      {data.bio && (
        <Block title="About">
          <p className="text-sm whitespace-pre-wrap">{data.bio}</p>
        </Block>
      )}
      {(data.skills.length > 0 || (data.interests?.length ?? 0) > 0) && (
        <Block title="Skills & interests">
          <div className="gap-1.5 flex flex-wrap">
            {data.skills.map((s) => (
              <Badge key={`s-${s}`} variant="primary">
                {s}
              </Badge>
            ))}
            {data.interests?.map((s) => (
              <Badge key={`i-${s}`} variant="neutral">
                {s}
              </Badge>
            ))}
          </div>
        </Block>
      )}
      {(data.links?.length ?? 0) > 0 && (
        <Block title="Links">
          <ul className="gap-1 text-sm flex flex-col">
            {data.links?.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1.5 inline-flex items-center text-primary-text hover:underline"
                >
                  {l.label} <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {(bday || data.joiningDate) && (
        <Block title="Milestones">
          <dl className="gap-y-1 gap-x-4 text-sm grid grid-cols-[auto_1fr]">
            {bday && (
              <>
                <dt className="gap-1.5 flex items-center text-muted-foreground">
                  <Cake className="size-3.5" aria-hidden />
                  Birthday
                </dt>
                <dd>{bday}</dd>
              </>
            )}
            {data.joiningDate && (
              <>
                <dt className="text-muted-foreground">Joined</dt>
                <dd>
                  {formatDate(data.joiningDate)}
                  {data.yearsOfService != null &&
                    ` · ${data.yearsOfService} ${data.yearsOfService === 1 ? 'year' : 'years'} of service`}
                </dd>
              </>
            )}
          </dl>
        </Block>
      )}
    </>
  );
}

function WorkSection({ data }: { data: EmployeeProfileView }) {
  const { workspaceId } = useCurrentWorkspace();
  const { updateEmployment } = usePeopleMutations(workspaceId);
  const [department, setDepartment] = useState(data.department ?? '');
  const [team, setTeam] = useState(data.team ?? '');
  const [joiningDate, setJoiningDate] = useState(data.joiningDate ?? '');
  const [leftAt, setLeftAt] = useState('');

  useEffect(() => {
    setDepartment(data.department ?? '');
    setTeam(data.team ?? '');
    setJoiningDate(data.joiningDate ?? '');
  }, [data.department, data.team, data.joiningDate]);

  const submit = () =>
    updateEmployment.mutate(
      {
        userId: data.userId,
        input: {
          department: department.trim() || null,
          team: team.trim() || null,
          joiningDate: joiningDate || null,
          ...(leftAt ? { leftAt } : {}),
        },
      },
      {
        onSuccess: () => toast.success('Employment details saved'),
        onError: (err) => toast.error(errorMessage(err, 'Could not save')),
      },
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SettingsCard>
        <p className="text-xs text-muted-foreground">
          HR-managed. Changes are written to the workspace audit log.
        </p>
        <div className="gap-4 sm:grid-cols-2 grid">
          <Field label="Department" optional>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              maxLength={80}
            />
          </Field>
          <Field label="Team" optional>
            <Input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              maxLength={80}
            />
          </Field>
          <Field
            label="Official joining date"
            optional
            hint="Drives work anniversaries."
          >
            <Input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </Field>
          <Field
            label="Leaving date"
            optional
            hint="Set when the employee leaves; stops celebrations."
          >
            <Input
              type="date"
              value={leftAt}
              onChange={(e) => setLeftAt(e.target.value)}
              min={joiningDate || undefined}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={updateEmployment.isPending}>
            Save changes
          </Button>
        </div>
      </SettingsCard>
    </form>
  );
}

/** A titled card — the design system's group + card, so every section matches Settings. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SettingsGroup title={title}>
      <SettingsCard className="space-y-3">{children}</SettingsCard>
    </SettingsGroup>
  );
}
