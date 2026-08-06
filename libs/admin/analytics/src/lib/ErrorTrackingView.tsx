import type { ErrorGroup } from '@org/types';
import { AlertOctagon, Bug, Layers, Trash2 } from 'lucide-react';
import { Button, SegmentedControl } from '@org/ui';
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
  if (severity === 'CRITICAL')
    return 'bg-destructive/10 border-destructive/40 text-destructive';
  if (severity === 'ERROR')
    return 'bg-warning/15 border-warning/40 text-warning';
  return 'bg-surface-raised border-border text-foreground';
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
        icon={<Bug />}
        accent="rose"
        title="Error Tracking"
        description="Platform-wide request failures with stack traces, first and last seen"
        actions={
          <>
            <SegmentedControl
              aria-label="Time range"
              size="sm"
              value={hours}
              onChange={setHours}
              options={HOUR_OPTIONS.map((option) => ({
                value: option.hours,
                label: option.label,
                hint: `Last ${option.hours} hours`,
              }))}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => clear.mutate()}
              loading={clear.isPending}
              leadingIcon={<Trash2 />}
              title="Clears the in-memory buffer; persisted workspace errors are kept"
            >
              Clear buffer
            </Button>
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
            <div className="md:grid-cols-4 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="Errors captured"
                value={data.totalErrors}
                icon={AlertOctagon}
                accent={data.totalErrors > 0 ? 'rose' : 'green'}
                hint={`last ${hours}h`}
              />
              <MetricCard
                label="Unique issues"
                value={data.uniqueGroups}
                icon={Layers}
                accent="violet"
              />
              <MetricCard
                label="Errors / hour"
                value={data.errorRate}
                icon={Bug}
                accent="amber"
              />
              <MetricCard
                label="Critical (5xx)"
                value={
                  data.bySeverity.find((slice) => slice.label === 'CRITICAL')
                    ?.value ?? 0
                }
                icon={AlertOctagon}
                accent="rose"
              />
            </div>

            <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
              <Panel
                title={`Error volume · last ${Math.min(hours, 48)} hours`}
                subtitle="Failures per hour"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.series}
                  accent="rose"
                  valueLabel="errors"
                />
              </Panel>

              <Panel
                title="By severity"
                subtitle="5xx is CRITICAL, 4xx is ERROR"
              >
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
                  <p className="text-sm font-medium text-success">
                    No errors in this window.
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Failed requests are captured automatically as they happen.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.groups.map((group) => (
                    <div
                      key={group.fingerprint}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      <button
                        type="button"
                        aria-expanded={expanded === group.fingerprint}
                        aria-controls={`error-detail-${group.fingerprint}`}
                        onClick={() =>
                          setExpanded(
                            expanded === group.fingerprint
                              ? null
                              : group.fingerprint,
                          )
                        }
                        className="gap-3 p-3 flex w-full items-start justify-between text-left transition-colors duration-(--duration-fast) hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:-outline-offset-2 focus-visible:outline-none"
                      >
                        <div className="min-w-0">
                          <div className="gap-2 mb-1 flex flex-wrap items-center">
                            <span
                              className={`px-1.5 py-0.5 font-semibold rounded-full border text-[10px] ${severityTone(
                                group.severity,
                              )}`}
                            >
                              {group.severity}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {group.statusCode} · {group.route}
                            </span>
                          </div>
                          <p className="text-xs font-medium truncate text-foreground">
                            {group.name}: {group.message}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            first {formatRelative(group.firstSeenAt)} · last{' '}
                            {formatRelative(group.lastSeenAt)}
                          </p>
                        </div>
                        <span className="text-sm font-bold shrink-0 text-foreground">
                          {formatNumber(group.count)}
                        </span>
                      </button>

                      {expanded === group.fingerprint ? (
                        <pre
                          id={`error-detail-${group.fingerprint}`}
                          className="scrollbar-subtle p-3 overflow-x-auto border-t bg-background font-mono text-[10px] whitespace-pre-wrap text-muted-foreground"
                        >
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
                        ? 'text-destructive'
                        : 'text-warning'
                    }
                  >
                    {error.statusCode}
                  </span>,
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {error.method} {error.route}
                  </span>,
                  <span className="text-foreground">
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
