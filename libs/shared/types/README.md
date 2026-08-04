# @org/types

Transport contracts shared by every layer.

## Design

Declared independently of Prisma so the browser never depends on anything under `scope:api`. The API maps persistence models onto these DTOs.

## Surface

- Enums: WorkspaceRole, ChannelRole, ChannelVisibility, InvitationStatus, PresenceStatus, SystemRole.
- Entities: PublicUser, CurrentUser, Workspace(Summary), Channel(Summary), members, invitations, uploads.
- API: `Paginated<T>`, `ApiErrorBody`, `ApiErrorCode`, `AuthTokens`.
- `hasWorkspaceRole()` — the shared privilege comparison used on both sides.

## Notes

Timestamps cross the wire as ISO strings; parse at the edge.

## Commands

```sh
nx lint @org/types
nx typecheck @org/types
```
