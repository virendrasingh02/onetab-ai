# @org/api-channel

Channels, channel membership, pins and files.

## Design

Visibility is one-way. A public channel can become private; the reverse is refused because it would retroactively expose history to people who never had access.

## Surface

- CRUD plus `archive`/`unarchive`/`make-private`.
- Membership: `join`, add/remove members, and per-user `preferences` (favorite, mute).
- Channel tabs: `members`, `pins`, `files`.

## Notes

`#general` cannot be archived. Channel management requires channel ADMIN or workspace ADMIN and above.

## Commands

```sh
nx test @org/api-channel
nx lint @org/api-channel
nx typecheck @org/api-channel
```
