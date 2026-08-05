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
        icon={<Users className="w-6 h-6 text-purple-400" />}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <MetricCard
                label="Daily active users"
                value={data.dau}
                icon={Flame}
                color="bg-orange-600/20 text-orange-400"
                hint="last 24 hours"
              />
              <MetricCard
                label="Weekly active users"
                value={data.wau}
                icon={CalendarDays}
                color="bg-blue-600/20 text-blue-400"
                hint="last 7 days"
              />
              <MetricCard
                label="Monthly active users"
                value={data.mau}
                icon={Users}
                color="bg-purple-600/20 text-purple-400"
                hint={`across the ${days}d range`}
              />
              <MetricCard
                label="Stickiness"
                value={`${data.stickiness}%`}
                icon={Activity}
                color="bg-emerald-600/20 text-emerald-400"
                hint="DAU ÷ MAU"
              />
              <MetricCard
                label="Tracked events"
                value={data.totalEvents}
                icon={Activity}
                color="bg-cyan-600/20 text-cyan-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title={`Activity · last ${days} days`}
                subtitle="Events recorded per day"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.activitySeries}
                  color="from-purple-600 to-fuchsia-500"
                />
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
                    <p className="text-slate-100 font-medium">{user.name}</p>
                    <p className="text-slate-500 text-[11px]">{user.email}</p>
                  </div>,
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                    {user.role}
                  </span>,
                  formatNumber(user.events),
                  formatNumber(user.messages),
                  formatNumber(user.tasks),
                  <span
                    className={
                      user.lastActiveAt ? 'text-slate-300' : 'text-slate-600'
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
