# @org/api-workspace

Workspace lifecycle.

## Design

Creating a workspace also creates the owner membership and a `#general` channel in one transaction — a workspace with no channel is not a usable state.

## Surface

- `GET /workspaces` — the switcher list, with the caller role and counts.
- `POST /workspaces`, `PATCH /workspaces/:id` (ADMIN+), `DELETE /workspaces/:id` (OWNER).
- `POST /workspaces/:id/transfer-ownership` — atomically promotes the target and demotes the previous owner.

## Notes

Non-members receive 404 rather than 403: confirming a workspace exists is itself a disclosure.

## Commands

```sh
nx test @org/api-workspace
nx lint @org/api-workspace
nx typecheck @org/api-workspace
```
