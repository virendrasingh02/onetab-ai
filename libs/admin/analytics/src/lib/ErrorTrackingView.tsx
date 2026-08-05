import type { ErrorGroup } from '@org/types';
import { AlertOctagon, Bug, Layers, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  BarChart,
  Breakdown,
  DataTable,
  MetricCard,
  Panel,
  QueryState,
  RefreshButton,
  ViewHeader,
  ViewShell,
  formatNumber,
  formatRelative,
} from '@org/analytics-ui';
import {
  useClearPlatformErrors,
  usePlatformErrorTracking,
} from './use-admin-analytics.js';

const HOUR_OPTIONS = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
] as const;

function severityTone(severity: ErrorGroup['severity']): string {
  if (severity === 'CRITICAL') return 'bg-red-950/60 border-red-500/40 text-red-400';
  if (severity === 'ERROR')
    return 'bg-amber-950/60 border-amber-500/40 text-amber-400';
  return 'bg-slate-800 border-slate-700 text-slate-300';
}

/**
 * Grouped request failures across the whole API process, live from its own
 * error collector.
 *
 * The workspace/platform toggle this screen used to carry is gone: the admin
 * console has no workspace in scope, so every reading here is platform-wide.
 */
export function ErrorTrackingView() {
  const [hours, setHours] = useState(24);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = usePlatformErrorTracking(hours);
  const clear = useClearPlatformErrors();
  const data = query.data;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Bug className="w-6 h-6 text-red-400" />}
        title="Error Tracking"
        description="Platform-wide request failures with stack traces, first and last seen"
        actions={
          <>
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
              {HOUR_OPTIONS.map((option) => (
                <button
                  key={option.hours}
                  type="button"
                  onClick={() => setHours(option.hours)}
                  className={`px-2.5 py-1 text-xs rounded-md transition ${
                    hours === option.hours
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => clear.mutate()}
              disabled={clear.isPending}
              className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/60 disabled:opacity-60 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition"
              title="Clears the in-memory buffer; persisted workspace errors are kept"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear buffer
            </button>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                label="Errors captured"
                value={data.totalErrors}
                icon={AlertOctagon}
                color={
                  data.totalErrors > 0
                    ? 'bg-red-600/20 text-red-400'
                    : 'bg-emerald-600/20 text-emerald-400'
                }
                hint={`last ${hours}h`}
              />
              <MetricCard
                label="Unique issues"
                value={data.uniqueGroups}
                icon={Layers}
                color="bg-purple-600/20 text-purple-400"
              />
              <MetricCard
                label="Errors / hour"
                value={data.errorRate}
                icon={Bug}
                color="bg-amber-600/20 text-amber-400"
              />
              <MetricCard
                label="Critical (5xx)"
                value={
                  data.bySeverity.find((slice) => slice.label === 'CRITICAL')
                    ?.value ?? 0
                }
                icon={AlertOctagon}
                color="bg-red-600/20 text-red-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title={`Error volume · last ${Math.min(hours, 48)} hours`}
                subtitle="Failures per hour"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.series}
                  color="from-red-600 to-orange-500"
                  valueLabel="errors"
                />
              </Panel>

              <Panel title="By severity" subtitle="5xx is CRITICAL, 4xx is ERROR">
                <Breakdown
                  slices={data.bySeverity}
                  emptyMessage="No errors captured in this range."
                />
              </Panel>
            </div>

            <Panel
              title="Issues"
              subtitle="Grouped by error type, normalised message and route"
              className="mb-6"
            >
              {data.groups.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-emerald-400 font-medium">
                    No errors in this window.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Failed requests are captured automatically as they happen.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.groups.map((group) => (
                    <div
                      key={group.fingerprint}
                      className="border border-slate-800 rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            expanded === group.fingerprint
                              ? null
                              : group.fingerprint,
                          )
                        }
                        className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-slate-800/40 transition"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 border text-[10px] font-semibold rounded-full ${severityTone(
                                group.severity,
                              )}`}
                            >
                              {group.severity}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {group.statusCode} · {group.route}
                            </span>
                          </div>
                          <p className="text-xs text-slate-100 font-medium truncate">
                            {group.name}: {group.message}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            first {formatRelative(group.firstSeenAt)} · last{' '}
                            {formatRelative(group.lastSeenAt)}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-white shrink-0">
                          {formatNumber(group.count)}
                        </span>
                      </button>

                      {expanded === group.fingerprint ? (
                        <pre className="text-[10px] text-slate-400 bg-slate-950/80 border-t border-slate-800 p-3 overflow-x-auto whitespace-pre-wrap">
                          {group.sample.stack ??
                            'No stack trace was captured for this error.'}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Most recent" subtitle="Newest failures first">
              <DataTable
                columns={['When', 'Status', 'Route', 'Error']}
                rows={data.recent.slice(0, 20).map((error) => [
                  formatRelative(error.occurredAt),
                  <span
                    className={
                      error.statusCode >= 500
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }
                  >
                    {error.statusCode}
                  </span>,
                  <span className="font-mono text-[11px] text-slate-400">
                    {error.method} {error.route}
                  </span>,
                  <span className="text-slate-300">
                    {error.name}: {error.message}
                  </span>,
                ])}
                emptyMessage="Nothing captured in this window."
              />
            </Panel>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
