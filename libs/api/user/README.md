# @org/api-user

User profiles and workspace-scoped people search.

## Design

Search is scoped to a workspace as a privacy boundary, not merely a filter — it stops the endpoint becoming a directory of every user on the platform.

## Surface

- `PATCH /users/me`, `PATCH /users/me/presence`, `GET /users/:id`.
- `GET /workspaces/:id/users/search` — people picker, behind the workspace guard.

## Notes

Password hashes are never selected into a response; `PUBLIC_USER_SELECT` defines the safe column set.

## Commands

```sh
nx test @org/api-user
nx lint @org/api-user
nx typecheck @org/api-user
```
