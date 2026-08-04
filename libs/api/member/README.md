# @org/api-member

Workspace membership and invitations.

## Design

Role changes are bounded by the actor role: nobody can grant a role at or above their own, which is what stops an ADMIN minting peers or escalating themselves.

## Surface

- `GET/PATCH/DELETE /workspaces/:id/members` and `POST .../members/leave`.
- `GET/POST/DELETE /workspaces/:id/invitations` (ADMIN+).
- `POST /invitations/accept` — outside the workspace guard, since the caller is not a member yet.

## Notes

An invitation is bound to the address it was sent to, so a forwarded link cannot be redeemed by someone else. The OWNER role moves only through an explicit transfer.

## Commands

```sh
nx test @org/api-member
nx lint @org/api-member
nx typecheck @org/api-member
```
