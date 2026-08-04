# @org/web-workspace

Workspace queries, mutations and screens.

## Design

`useCurrentWorkspace()` resolves the slug from the URL and the id from cache in one place, because every workspace-scoped screen needs both.

## Surface

- `useWorkspaces`, `useWorkspace`, `useCurrentWorkspace`, `useCreateWorkspace`, `useUpdateWorkspace`, `useDeleteWorkspace`.
- `CreateWorkspacePage` — live slug suggestion that stops tracking once the user edits the slug.
- `WorkspaceSettingsPage` — general settings plus an owner-only danger zone.
- `WorkspaceRedirect` — resolves bare `/` to the first workspace, or to onboarding.

## Notes

Deleting a workspace requires typing its exact slug — the guard against an accidental click.

## Commands

```sh
nx lint @org/web-workspace
nx typecheck @org/web-workspace
```
