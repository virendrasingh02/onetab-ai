# @org/web-workspace

Workspace queries, mutations and screens.

## Design

`useCurrentWorkspace()` resolves the slug from the URL and the id from cache in one place, because every workspace-scoped screen needs both.

`useCreateWorkspaceFlow()` runs onboarding as one call — workspace, then logo, then invitations. They cannot collapse into a single request, because the logo and the invitations each need a workspace id to attach to. Only the first step is fatal: once the workspace exists, a failed logo or invite is reported as a warning rather than discarding the workspace.

## Surface

- `useWorkspaces`, `useWorkspace`, `useCurrentWorkspace`, `useCreateWorkspace`, `useCreateWorkspaceFlow`, `useUpdateWorkspace`, `useDeleteWorkspace`.
- `CreateWorkspacePage` — two steps: identity (name, slug, description, logo) then invites, which can be skipped. Live slug suggestion that stops tracking once the user edits the slug.
- `WorkspaceSettingsPage` — general settings plus an owner-only danger zone.
- `WorkspaceRedirect` — resolves bare `/` to the first workspace, or to onboarding.

## Notes

Deleting a workspace requires typing its exact slug — the guard against an accidental click.

## Commands

```sh
nx lint @org/web-workspace
nx typecheck @org/web-workspace
```
