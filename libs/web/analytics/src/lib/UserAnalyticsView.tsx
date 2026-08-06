import { Activity, CalendarDays, Flame, Users } from 'lucide-react';
import { useState } from 'react';
import {
  BarChart,
  Breakdown,
  DataTable,
  MetricCard,
  Panel,
  QueryState,
  RangePicker,
  RefreshButton,
  ViewHeader,
  ViewShell,
  formatNumber,
  formatRelative,
} from '@org/analytics-ui';
import { useUserAnalytics } from './use-analytics.js';

/** Engagement: who is active, how often, and on which parts of the product. */
export function UserAnalyticsView() {
  const [days, setDays] = useState(30);
  const query = useUserAnalytics(days);
  const data = query.data;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Users />}
        accent="violet"
        title="User Analytics"
        description="Active users, stickiness and per-member engagement"
        actions={
          <>
            <RangePicker days={days} onChange={setDays} />
            <RefreshButton
              onClick={() => query.refetch()}
              busy={query.isFetching}
            />
          </>
        }
      />

      <QueryState isLoading={query.isLoading} error={query.error}>
        {data ? (
          <>
            <div className="md:grid-cols-5 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="Daily active users"
                value={data.dau}
                icon={Flame}
                accent="orange"
                hint="last 24 hours"
              />
              <MetricCard
                label="Weekly active users"
                value={data.wau}
                icon={CalendarDays}
                accent="blue"
                hint="last 7 days"
              />
              <MetricCard
                label="Monthly active users"
                value={data.mau}
                icon={Users}
                accent="violet"
                hint={`across the ${days}d range`}
              />
              <MetricCard
                label="Stickiness"
                value={`${data.stickiness}%`}
                icon={Activity}
                accent="green"
                hint="DAU ÷ MAU"
              />
              <MetricCard
                label="Tracked events"
                value={data.totalEvents}
                icon={Activity}
                accent="cyan"
              />
            </div>

            <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
              <Panel
                title={`Activity · last ${days} days`}
                subtitle="Events recorded per day"
                className="lg:col-span-2"
              >
                <BarChart series={data.activitySeries} accent="violet" />
              </Panel>

              <Panel title="Event types" subtitle="What users are doing">
                <Breakdown
                  slices={data.eventBreakdown}
                  emptyMessage="No events recorded in this range."
                />
              </Panel>
            </div>

            <Panel
              title="Member engagement"
              subtitle="Ranked by combined events, messages and tasks"
            >
              <DataTable
                columns={[
                  'Member',
                  'Role',
                  'Events',
                  'Messages',
                  'Tasks',
                  'Last active',
                ]}
                rows={data.topUsers.map((user) => [
                  <div>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {user.email}
                    </p>
                  </div>,
                  <span className="px-1.5 py-0.5 rounded font-semibold bg-surface-raised text-[10px] text-foreground">
                    {user.role}
                  </span>,
                  formatNumber(user.events),
                  formatNumber(user.messages),
                  formatNumber(user.tasks),
                  <span
                    className={
                      user.lastActiveAt
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    {formatRelative(user.lastActiveAt)}
                  </span>,
                ])}
                emptyMessage="No members in this workspace yet."
              />
            </Panel>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
