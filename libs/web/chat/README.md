# @org/web-chat

Wires `@org/matrix-client` to `@org/chat-ui`. The only place the web app touches
Matrix.

## Design

The browser never sees a Matrix password. `MatrixProvider` calls
`POST /matrix/session`, receives a single-use login token from our API, and signs
in with it. When Matrix is not configured the provider reports chat as
unavailable rather than failing — the rest of the app keeps working.

Room state is held in a local reducer-style store rather than TanStack Query. A
Matrix timeline is a push stream, not a cache to invalidate; modelling it as a
query would mean refetching a room every time an event arrived.

## Surface

- `<MatrixProvider>` / `useMatrix()` — client lifecycle and connection status.
- `useRoom(roomId)` — messages, members, typing, loading and error state for one
  room, plus older-message pagination.
- `useRoomActions(roomId)` — send, edit, delete, react, upload, typing, read
  receipts.
- `usePresence(userIds)` — presence for a set of users.
- `<ChatPanel>` — the assembled chat surface for a channel or DM.

## Notes

**Client creation is guarded against double-mounting.** React 18 StrictMode mounts
effects twice in development; without the guard that spends the single-use login
token twice and leaves two sync loops running.

**Unmount stops syncing but keeps the session**, so remounting reconnects cheaply
instead of re-running the token exchange.

## Commands

```sh
nx lint @org/web-chat
nx typecheck @org/web-chat
```
