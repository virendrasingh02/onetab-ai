import { useCurrentUser } from '@org/auth';
import {
  daysInMonth,
  formatYMD,
  type CelebrationEntry,
  type EmployeeCard,
  type YMD,
} from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  EmptyState,
  PageBar,
  PageTabBar,
  Pagination,
  SearchInput,
  SegmentedControl,
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
  Tabs,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Cake,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PartyPopper,
  Search,
  UserCog,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCelebrations, useEmployeeDirectory } from '../use-people.js';

type PeopleTab = 'directory' | 'celebrations';
const PAGE_SIZE = 24;
const ALL = '__all__';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localToday(): YMD {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

/**
 * Team directory + celebrations. The role / AI-coworker administration page
 * lives on at `members`; this is the employee-facing view of the same people.
 */
export function PeoplePage() {
  const { workspaceId } = useCurrentWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: PeopleTab =
    params.get('tab') === 'celebrations' ? 'celebrations' : 'directory';
  const setTab = (next: PeopleTab) =>
    setParams(next === 'directory' ? {} : { tab: next }, { replace: true });

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <PageBar
        icon={<Users />}
        title="People"
        hasTabs
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('me')}>
              My profile
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('../members')}
            >
              <UserCog className="size-4" aria-hidden /> Roles &amp; AI
              coworkers
            </Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as PeopleTab)}>
        <PageTabBar>
          <TabsTrigger
            value="directory"
            icon={<Users className="size-4" aria-hidden />}
          >
            Directory
          </TabsTrigger>
          <TabsTrigger
            value="celebrations"
            icon={<PartyPopper className="size-4" aria-hidden />}
          >
            Celebrations
          </TabsTrigger>
        </PageTabBar>
      </Tabs>
      <div className="min-h-0 px-3 py-4 sm:px-6 flex-1 overflow-y-auto">
        {workspaceId && tab === 'directory' && (
          <DirectoryTab workspaceId={workspaceId} />
        )}
        {workspaceId && tab === 'celebrations' && (
          <CelebrationsTab workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}

// --- directory -------------------------------------------------------------------

function DirectoryTab({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
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
  const { data, isLoading, isError, refetch, isFetching } =
    useEmployeeDirectory(workspaceId, filters);

  const facetOptions = (label: string, values: string[] | undefined) => [
    { value: ALL, label: `All ${label}` },
    ...(values ?? []).map((v) => ({ value: v, label: v })),
  ];
  const hasFilters =
    !!q || department !== ALL || team !== ALL || location !== ALL;
  const reset = () => {
    setSearch('');
    setDepartment(ALL);
    setTeam(ALL);
    setLocation(ALL);
    setPage(1);
  };

  return (
    <div className="gap-4 max-w-6xl mx-auto flex w-full flex-col">
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
        <div
          className="gap-3 sm:grid-cols-2 lg:grid-cols-3 grid"
          aria-busy="true"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="gap-3 p-4 flex items-center rounded-xl border border-border"
            >
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
          title={
            hasFilters ? 'No one matches those filters' : 'No employees yet'
          }
          description={
            hasFilters
              ? 'Try a different search or clear the filters.'
              : 'Invite teammates to get started.'
          }
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
            className={`gap-3 sm:grid-cols-2 lg:grid-cols-3 grid ${isFetching ? 'opacity-70' : ''}`}
            aria-label="Employees"
          >
            {data.items.map((e) => (
              <li key={e.userId}>
                <EmployeeCardButton
                  employee={e}
                  onOpen={() => navigate(e.userId)}
                />
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
            totalItems={data.total}
            pageSize={data.pageSize}
            pageSizeOptions={[PAGE_SIZE]}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function EmployeeCardButton({
  employee,
  onOpen,
}: {
  employee: EmployeeCard;
  onOpen: () => void;
}) {
  const sub = [employee.jobTitle, employee.team ?? employee.department]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="gap-3 p-4 flex w-full cursor-pointer items-start rounded-xl border border-border bg-surface-raised text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
    >
      <UserAvatar
        name={employee.name}
        src={employee.avatarUrl}
        seed={employee.userId}
      />
      <span className="min-w-0 flex-1">
        <span className="gap-2 flex items-center">
          <span className="text-sm font-medium truncate text-foreground">
            {employee.name}
          </span>
          {employee.isSelf && <Badge variant="primary">You</Badge>}
        </span>
        {sub && (
          <span className="text-xs block truncate text-muted-foreground">
            {sub}
          </span>
        )}
        {employee.location && (
          <span className="mt-1 gap-1 text-xs flex items-center text-muted-foreground">
            <MapPin className="size-3" aria-hidden /> {employee.location}
          </span>
        )}
        {employee.skills.length > 0 && (
          <span className="mt-2 gap-1 flex flex-wrap">
            {employee.skills.slice(0, 3).map((s) => (
              <Badge
                key={s}
                variant="neutral"
                className="px-1.5 py-0 text-[11px]"
              >
                {s}
              </Badge>
            ))}
            {employee.skills.length > 3 && (
              <span className="text-[11px] text-muted-foreground">
                +{employee.skills.length - 3}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

// --- celebrations ----------------------------------------------------------------

function CelebrationsTab({ workspaceId }: { workspaceId: string }) {
  const today = useMemo(localToday, []);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [cursor, setCursor] = useState({ y: today.y, m: today.m });

  const monthStart: YMD = { y: cursor.y, m: cursor.m, d: 1 };
  const monthDays = daysInMonth(cursor.y, cursor.m);
  const fromStr =
    view === 'calendar' ? formatYMD(monthStart) : formatYMD(today);
  const days = view === 'calendar' ? monthDays : 90;
  const { data, isLoading, isError, refetch } = useCelebrations(
    workspaceId,
    fromStr,
    days,
  );

  const shift = (delta: number) =>
    setCursor((c) => {
      const idx = c.y * 12 + (c.m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });

  return (
    <div className="gap-4 max-w-5xl mx-auto flex w-full flex-col">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        {view === 'calendar' ? (
          <div className="gap-1 flex items-center">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => shift(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2
              className="min-w-40 px-2 text-sm font-semibold text-center"
              aria-live="polite"
            >
              {MONTHS[cursor.m - 1]} {cursor.y}
            </h2>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => shift(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor({ y: today.y, m: today.m })}
            >
              Today
            </Button>
          </div>
        ) : (
          <h2 className="text-sm font-semibold">Next 90 days</h2>
        )}
        <SegmentedControl
          aria-label="Celebrations view"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : isError ? (
        <EmptyState
          icon={<PartyPopper />}
          title="Couldn't load celebrations"
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : view === 'calendar' ? (
        <MonthGrid
          year={cursor.y}
          month={cursor.m}
          today={today}
          entries={data ?? []}
        />
      ) : (
        <CelebrationList entries={data ?? []} />
      )}
      <p className="text-xs text-muted-foreground">
        Only birthdays and anniversaries that colleagues chose to share with you
        are shown.
      </p>
    </div>
  );
}

const entryLabel = (e: CelebrationEntry) =>
  e.kind === 'BIRTHDAY'
    ? `${e.name} — birthday`
    : `${e.name} — ${e.years} year${e.years === 1 ? '' : 's'}`;

function MonthGrid({
  year,
  month,
  today,
  entries,
}: {
  year: number;
  month: number;
  today: YMD;
  entries: CelebrationEntry[];
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, CelebrationEntry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [entries]);
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const total = daysInMonth(year, month);
  const cells = Array.from(
    { length: Math.ceil((lead + total) / 7) * 7 },
    (_, i) => i - lead + 1,
  );

  return (
    <div
      role="grid"
      aria-label={`${MONTHS[month - 1]} ${year}`}
      className="overflow-x-auto"
    >
      <div className="min-w-[640px] rounded-xl border border-border">
        <div
          role="row"
          className="grid grid-cols-7 border-b border-border bg-surface-inset"
        >
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              role="columnheader"
              className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const inMonth = day >= 1 && day <= total;
            const key = inMonth ? formatYMD({ y: year, m: month, d: day }) : '';
            const items = inMonth ? (byDate.get(key) ?? []) : [];
            const isToday =
              inMonth &&
              year === today.y &&
              month === today.m &&
              day === today.d;
            return (
              <div
                key={i}
                role="gridcell"
                className={`min-h-24 gap-1 p-1.5 flex flex-col border-r border-b border-border last:border-r-0 ${inMonth ? '' : 'bg-surface-inset/50'}`}
              >
                {inMonth && (
                  <span
                    className={`size-5 text-xs flex items-center justify-center rounded-full ${isToday ? 'font-semibold bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    {day}
                  </span>
                )}
                {items.slice(0, 3).map((e) => (
                  <span
                    key={`${e.kind}-${e.userId}`}
                    title={entryLabel(e)}
                    className={`gap-1 px-1 rounded flex items-center truncate text-[11px] ${e.kind === 'BIRTHDAY' ? 'bg-info/10 text-info-text' : 'bg-success/10 text-success-text'}`}
                  >
                    {e.kind === 'BIRTHDAY' ? (
                      <Cake className="size-3 shrink-0" aria-hidden />
                    ) : (
                      <PartyPopper className="size-3 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{e.name.split(' ')[0]}</span>
                  </span>
                ))}
                {items.length > 3 && (
                  <span className="px-1 text-[11px] text-muted-foreground">
                    +{items.length - 3} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {entries.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No shared birthdays or anniversaries this month.
        </p>
      )}
    </div>
  );
}

function CelebrationList({ entries }: { entries: CelebrationEntry[] }) {
  const me = useCurrentUser();
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Nothing coming up"
        description="Birthdays and work anniversaries that teammates share with you will appear here."
      />
    );
  }
  const section = (e: CelebrationEntry) =>
    e.daysUntil === 0
      ? 'Today'
      : e.daysUntil <= 7
        ? 'This week'
        : e.daysUntil <= 31
          ? 'This month'
          : 'Later';
  const order = ['Today', 'This week', 'This month', 'Later'];
  const groups = order
    .map((name) => ({
      name,
      items: entries.filter((e) => section(e) === name),
    }))
    .filter((g) => g.items.length > 0);
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="gap-5 flex flex-col">
      {groups.map((g) => (
        <section key={g.name} aria-label={g.name}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {g.name}
          </h3>
          <ul className="gap-2 flex flex-col">
            {g.items.map((e) => (
              <li
                key={`${e.kind}-${e.userId}-${e.date}`}
                className="gap-3 p-3 flex items-center rounded-xl border border-border bg-surface-raised"
              >
                <UserAvatar name={e.name} src={e.avatarUrl} seed={e.userId} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {e.name}
                    {me?.id === e.userId ? ' (you)' : ''}
                  </p>
                  <p className="text-xs truncate text-muted-foreground">
                    {e.kind === 'BIRTHDAY'
                      ? 'Birthday'
                      : `${e.years} year${e.years === 1 ? '' : 's'} at the company`}
                    {e.jobTitle ? ` · ${e.jobTitle}` : ''}
                  </p>
                </div>
                {e.isMilestone && <Badge variant="warning">Milestone</Badge>}
                <span className="text-xs shrink-0 text-muted-foreground">
                  {e.daysUntil === 0 ? 'Today' : fmt(e.date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
