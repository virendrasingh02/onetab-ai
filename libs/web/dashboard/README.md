# @org/web-dashboard

Workspace landing screen.

## Design

Aggregates data already in the query cache (workspace, channels, members) rather than adding a bespoke summary endpoint, so the dashboard costs no extra round trips.

## Surface

- `DashboardPage` — counts, your channels and teammates.

## Notes

Purely a composition layer; it owns no queries of its own.

## Commands

```sh
nx lint @org/web-dashboard
nx typecheck @org/web-dashboard
```
