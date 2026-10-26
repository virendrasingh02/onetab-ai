import {
  describeDaysUntil,
  todayInZone,
  upcomingCelebrations,
  type EmployeeCard,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  EmptyState,
  PageBar,
  Pagination,
  SearchInput,
  SkeletonAvatar,
  SkeletonText,
  UserAvatar,
  useRightPanelStore,
} from '@org/ui';
import {
  useCurrentWorkspace,
  useEmployeeDirectory,
  useEmployeeProfile,
} from '@org/web-workspace';
import { Cake, PartyPopper, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Page size; the pager only appears once there are more people than this. */
const PAGE_SIZE = 48;
const ALL = '__all__';
/** A birthday / anniversary this close gets a badge on the directory card. */
const CELEBRATION_BADGE_DAYS = 7;

/** Opens the shared profile rail for a directory entry. */
function useOpenEmployeeProfile() {
  const openProfile = useRightPanelStore((s) => s.openProfile);
  return (e: EmployeeCard) =>
    openProfile({
      userId: e.userId,
      name: e.name,
      avatarUrl: e.avatarUrl ?? undefined,
      title: e.jobTitle ?? undefined,
      email: e.email ?? undefined,
      bio: e.bio ?? undefined,
      timezone: e.timezone ?? undefined,
    });
}

/**
 * Employee directory. Profiles — including birthdays and work anniversaries —
 * open in the shared right-hand rail. The role / AI-coworker admin page lives
 * on at `members`.
 */
export function PeoplePage() {
  const { workspaceId } = useCurrentWorkspace();
  const openEmployee = useOpenEmployeeProfile();

  // `?person=<id>` (from a celebration notification) opens that person's rail.
  const [params, setParams] = useSearchParams();
  const personId = params.get('person') ?? undefined;
  const linked = useEmployeeProfile(workspaceId, personId);
  useEffect(() => {
    if (!personId || !linked.data) return;
    openEmployee(linked.data);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per link
  }, [personId, linked.data]);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <PageBar
        icon={<Users />}
        title="People"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {workspaceId && <DirectoryTab workspaceId={workspaceId} onOpen={openEmployee} />}
      </div>
    </div>
  );
}

function DirectoryTab({
  workspaceId,
  onOpen,
}: {
  workspaceId: string;
  onOpen: (e: EmployeeCard) => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState(ALL);
  const [team, setTeam] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [sort, setSort] = useState<'name' | 'department' | 'joined'>('name');
  const [page, setPage] = useState(1);

  // Debounce typing; any filter change returns to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(
    () => ({
      q: q || undefined,
      department: department === ALL ? undefined : department,
      team: team === ALL ? undefined : team,
      location: location === ALL ? undefined : location,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    [q, department, team, location, sort, page],
  );
  const { data, isLoading, isError, refetch, isFetching } = useEmployeeDirectory(workspaceId, filters);

  const facetOptions = (label: string, values: string[] | undefined) => [
    { value: ALL, label: `All ${label}` },
    ...(values ?? []).map((v) => ({ value: v, label: v })),
  ];
  const hasFilters = !!q || department !== ALL || team !== ALL || location !== ALL;
  const reset = () => {
    setSearch('');
    setDepartment(ALL);
    setTeam(ALL);
    setLocation(ALL);
    setPage(1);
  };

  return (
    <div className="gap-4 mx-auto flex w-full max-w-6xl flex-col">
      <div className="gap-2 flex flex-wrap items-center">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search name, title, team, location, skill…"
          label="Search employees"
          wrapperClassName="w-full sm:w-80"
        />
        <AppSelect
          aria-label="Department"
          size="sm"
          className="w-40"
          value={department}
          onValueChange={(v) => {
            setDepartment(v);
            setPage(1);
          }}
          options={facetOptions('departments', data?.facets.departments)}
        />
        <AppSelect
          aria-label="Team"
          size="sm"
          className="w-36"
          value={team}
          onValueChange={(v) => {
            setTeam(v);
            setPage(1);
          }}
          options={facetOptions('teams', data?.facets.teams)}
        />
        <AppSelect
          aria-label="Location"
          size="sm"
          className="w-40"
          value={location}
          onValueChange={(v) => {
            setLocation(v);
            setPage(1);
          }}
          options={facetOptions('locations', data?.facets.locations)}
        />
        <AppSelect
          aria-label="Sort by"
          size="sm"
          className="w-36"
          value={sort}
          onValueChange={(v) => {
            setSort(v as typeof sort);
            setPage(1);
          }}
          options={[
            { value: 'name', label: 'Sort: Name' },
            { value: 'department', label: 'Sort: Department' },
            { value: 'joined', label: 'Sort: Joined' },
          ]}
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="gap-3 grid sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="gap-3 p-4 flex items-center rounded-xl border border-border">
              <SkeletonAvatar />
              <SkeletonText className="flex-1" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<Search />}
          title="Couldn't load the directory"
          description="Something went wrong fetching your teammates."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={hasFilters ? 'No one matches those filters' : 'No employees yet'}
          description={hasFilters ? 'Try a different search or clear the filters.' : 'Invite teammates to get started.'}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={reset}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul
            className={`gap-3 grid sm:grid-cols-2 lg:grid-cols-3 ${isFetching ? 'opacity-70' : ''}`}
            aria-label="Employees"
          >
            {data.items.map((e) => (
              <li key={e.userId}>
                <EmployeeCardButton employee={e} onOpen={() => onOpen(e)} />
              </li>
            ))}
          </ul>
          {data.total > data.pageSize ? (
            <Pagination
              page={data.page}
              totalPages={Math.ceil(data.total / data.pageSize)}
              totalItems={data.total}
              pageSize={data.pageSize}
              pageSizeOptions={[PAGE_SIZE]}
              onPageChange={setPage}
            />
          ) : (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {data.total} {data.total === 1 ? 'person' : 'people'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** The soonest birthday / anniversary within a week, as a card badge. */
function CelebrationBadge({ employee }: { employee: EmployeeCard }) {
  const soonest = upcomingCelebrations(
    employee,
    todayInZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    CELEBRATION_BADGE_DAYS,
  )[0];
  if (!soonest) return null;
  const Icon = soonest.kind === 'BIRTHDAY' ? Cake : PartyPopper;
  const label =
    soonest.kind === 'BIRTHDAY'
      ? `Birthday ${describeDaysUntil(soonest.daysUntil)}`
      : `${soonest.years}-year anniversary ${describeDaysUntil(soonest.daysUntil)}`;
  return (
    <Badge variant={soonest.daysUntil === 0 ? 'success' : 'info'} className="mt-2 gap-1 px-1.5 py-0 text-[11px]">
      <Icon className="size-3" aria-hidden /> {label}
    </Badge>
  );
}

function EmployeeCardButton({ employee, onOpen }: { employee: EmployeeCard; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="gap-3 p-4 flex w-full cursor-pointer items-center rounded-xl border border-border bg-surface-raised text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
    >
      <UserAvatar name={employee.name} src={employee.avatarUrl} seed={employee.userId} />
      <span className="min-w-0 flex-1">
        <span className="gap-2 flex items-center">
          <span className="truncate text-sm font-medium text-foreground">{employee.name}</span>
          {employee.isSelf && <Badge variant="primary">You</Badge>}
        </span>
        <span className="block">
          <CelebrationBadge employee={employee} />
        </span>
      </span>
    </button>
  );
}
