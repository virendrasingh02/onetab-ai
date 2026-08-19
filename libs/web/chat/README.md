# @org/web-chat

Wires `@org/matrix-client` to `@org/chat-ui`. The only place the web app touches
Matrix.

## Design

The browser never sees a Matrix password. `MatrixProvider` reads
`GET /matrix/config` for the homeserver address and the signed-in user's Matrix
id, resumes the session stored in this browser if it belongs to that same user,
and only calls `POST /matrix/session` when there is nothing to resume — each of
those registers a device on the homeserver, and the stored one is what carries
this browser's encryption keys. When Matrix is not configured the provider
reports chat as unavailable rather than failing — the rest of the app keeps
working.

Room state is held in a local reducer-style store rather than TanStack Query. A
Matrix timeline is a push stream, not a cache to invalidate; modelling it as a
query would mean refetching a room every time an event arrived.

## Surface

- `<MatrixProvider>` / `useMatrix()` — client lifecycle and connection status.
- `<ChannelChat channelId title subtitle>` — a channel's conversation, room
  resolution included. This is what feature libraries mount.
- `useChannelRoom(channelId)` — resolves (and provisions on first open) the
  Matrix room backing a channel.
- `useRoom(roomId)` — messages, members, typing, loading and error state for one
  room, plus older-message pagination.
- `useRoomActions(roomId)` — send, edit, delete, react, upload, typing, read
  receipts.
- `usePresence(userIds)` — presence for a set of users.
- `<ChatPanel roomId>` — the assembled chat surface, when the room is already
  known.

## Notes

**Client creation is guarded against double-mounting.** React 18 StrictMode mounts
effects twice in development; without the guard that spends the single-use login
token twice and leaves two sync loops running.

**Unmount stops syncing but keeps the session**, so remounting reconnects cheaply
instead of re-running the token exchange.

**Room resolution is a query, the timeline is not.** `useChannelRoom` is cached
with `staleTime: Infinity` because a channel's room id never changes and
provisioning it costs a round trip. The timeline stays outside TanStack Query for
the opposite reason — it is a push stream. The query stays disabled until the
client is connected, so a deployment without a homeserver never provisions rooms
it cannot use.

## Commands

```sh
nx lint @org/web-chat
nx typecheck @org/web-chat
```
