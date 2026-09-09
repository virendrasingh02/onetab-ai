# Background Update & Sync — follow-ups

The In-App Background Update & Sync System landed on 2026-09-09 (uncommitted).
Core spine, wiring, backend digest endpoint, SSE reconnect replay, and tests are
in. This tracks the deliberately-deferred pieces from that pass.

## Deferred

| # | Item | Why deferred / next step |
|---|---|---|
| 1 | **Single shared SSE socket across tabs** | Leader election (`SyncLeader`, Web Locks) currently de-duplicates only the *polling* + *catch-up* traffic; each tab still opens its own `EventSource`. A true single socket needs a `SharedWorker` (or the leader relaying every event over `BroadcastChannel`, which loses per-tab `Last-Event-ID` precision). Move `RealtimeClient` behind a `SharedWorker` and have followers subscribe to the worker's port. |
| 2 | **Offline queue for content mutations** | `OfflineActionQueue` is wired only to idempotent read-state actions (`notification.markRead` / `markAllRead` / `dismiss`, `presence.set` — see `offline-executors.ts`). Task/comment/message creates need real conflict handling and per-mutation opt-in. Add executors + `enqueueOfflineAction` calls at those mutation sites, with a server-authoritative merge on replay-conflict (409/412 → surface, don't silently apply). |
| 3 | **Background file-upload continuation across navigation** | Uploads still abort when the channel view unmounts. Needs the upload to run off a store/worker rather than component state, then a progress surface fed from `useSyncStatus`-style state. |
| 4 | **Desktop main-process background sync** | `apps/desktop` still relies on the renderer being alive. A minimized/tray desktop app gets no background reconciliation. Options: keep a hidden renderer alive, or a small main-process poller for unread counts feeding the tray badge + native notifications. |
| 5 | **Service worker / Web Push** | No SW registered; no Web Push. `notification-service.ts` covers in-page + Electron native notifications only. A SW would also enable true background message sync on web. |
| 6 | **`web-version-indicator` cadence** | `libs/web/desktop/.../web-version-indicator.tsx` still polls `webMetadata` every 10 min unconditionally (it is not currently mounted anywhere in source). If it is re-mounted, gate its `refetchInterval` on `useSyncCadence('low')` — but its query key (`['web-version-meta']`) is not workspace-scoped, so it cannot be a `useBackgroundResource`. |
| 7 | **`MatrixProvider` 1s token poll** | `libs/web/chat/matrix-provider.tsx` keeps a `setInterval(…, 1000)` that only does a string compare of `getAccessToken()` and acts on change. Left as-is (negligible cost, load-bearing 401-storm backoff). Could be replaced with a `storage` + `visibilitychange` nudge. |
| 8 | **Per-channel unread parity** | Channel/DM unread still comes from `useLiveRoomActivity` (Matrix room counts) merged over the notification feed — unchanged. The `/sync/changes` digest reports *notification* rows, not per-Matrix-room read state. |
| 9 | **`e2e` scenarios from the brief §23** | The unit + service specs are in; the full end-to-end matrix (receive-while-elsewhere, DM-while-minimized, reconnect-after-failure, multi-tab, session-expiry, background upload, agent-response-after-navigation) needs `infra:start` + a running API + Playwright and was not run this pass. |
