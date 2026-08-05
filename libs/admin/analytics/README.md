# @org/admin-analytics

The platform-operations half of the analytics suite: performance, error
tracking and dependency health.

## Why these three and not the other six

The split follows the data, not the screen. These three read the **API process
itself** — event-loop lag, heap usage, captured exceptions, database and cache
reachability — and never take a workspace id. The six that stayed in
`@org/web-analytics` (dashboard, reports, users, AI usage, workspace, storage)
aggregate one workspace's activity and are meaningless without a workspace in
scope.

That is also why the hooks were rewritten rather than moved verbatim: the
originals resolved a workspace through `useCurrentWorkspace()` from
`@org/web-workspace`, which `scope:admin` may not depend on. The versions in
`use-admin-analytics.ts` call the same platform endpoints with no workspace
argument.

## Behaviour that changed in the move

`ErrorTrackingView` lost its workspace/platform toggle. It was defaulting to
workspace scope, which the console cannot resolve; the screen is now
unconditionally platform-wide and the "Clear buffer" action — previously hidden
unless the toggle was on `platform` — is always available.

## Surface

| Export                     | Screen                                          |
| -------------------------- | ----------------------------------------------- |
| `PerformanceMonitoringView` | Latency, throughput, memory, slow queries       |
| `ErrorTrackingView`         | Grouped failures with stack traces              |
| `HealthDashboardView`       | Live dependency probes                          |

Presentational pieces come from `@org/analytics-ui`, shared with the web app's
workspace-scoped screens.
