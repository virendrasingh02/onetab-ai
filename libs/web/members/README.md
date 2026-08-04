# @org/web-members

Workspace member list and role management.

## Design

The UI hides actions the API would reject anyway (owner rows, self-management), but the server remains the authority — the guards are enforced server-side regardless.

## Surface

- `useMembers`, `useMemberSearch`, `useMemberMutations`.
- `MembersPage` — search, role changes and removal for ADMIN and above.

## Notes

Role menus are hidden for the OWNER row and for the signed-in user.

## Commands

```sh
nx lint @org/web-members
nx typecheck @org/web-members
```
