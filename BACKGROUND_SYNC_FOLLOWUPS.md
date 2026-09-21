# Background Update & Sync — follow-ups

The In-App Background Update & Sync System landed on 2026-09-09 (uncommitted).
Core spine, wiring, backend digest endpoint, SSE reconnect replay, and tests are
in. This tracks the deliberately-deferred pieces from that pass.

## Update — 2026-09-21

Item #2 is now **partially done**. What shipped:

- `OfflineActionQueue.replay()` (`libs/shared/sync/src/lib/offline-queue.ts`)
  gained an `onDropped` callback, fired for every terminal drop (unknown kind,
  or a non-retryable `classifyError` result — permission/validation/conflict).
  `BackgroundSyncManager` wires it into a new `syncStore.lastDroppedAction`
  field; `OfflineConflictToastBridge` (`libs/web/layout/src/lib/sync/`,
  mounted in `app-shell.tsx`) watches it and fires exactly one `toast.error`
  per drop. This was the prerequisite the original note called for
  ("surface, don't silently apply") before any content mutation could safely
  use the queue.
- `useNotificationMutations` (mark read / mark all / dismiss) was rewired to
  actually call `enqueueOfflineAction` instead of a plain `useMutation` that
  bypassed the queue — the registered executors existed but had **zero**
  production call sites before this; this was the clearest "built but never
  wired" gap found in an audit of the actual code.
- Two new executors, `task.create` and `taskComment.create`
  (`offline-executors.ts`), plus `useTaskMutations().create` and
  `useAddTaskComment` (`libs/web/work-tools/src/lib/use-work-tools.ts`) now
  branch on `useSyncStatus().phase === 'offline'`: online is unchanged, offline
  durably queues the creation (survives a reload) instead of the request
  failing and losing what was typed, and resolves with `null`/`'queued'`
  rather than a fabricated entity. The one caller that consumed the resolved
  task (`server-board.ts`'s bottom-of-column reorder) and the comment
  composer (`CardDetailsDialog.tsx`, which no longer clears the draft until
  the send is actually captured) were updated accordingly.

Still not done, and now the accurate scope of what's left on item #2: a
fabricated **optimistic UI** for the offline-queued case (a task/comment
doesn't visually appear until the queue replays and the next catch-up picks
it up — no synthetic `Task`/`TaskComment` object is inserted into the
relevant caches, since guessing at that shape blind was judged riskier than
the honest "it's queued, not instantly rendered" gap it leaves), and message
send is deliberately untouched (see its own row below).

## Deferred

| # | Item | Why deferred / next step |
|---|---|---|
| 1 | **Single shared SSE socket across tabs** | Leader election (`SyncLeader`, Web Locks) currently de-duplicates only the *polling* + *catch-up* traffic; each tab still opens its own `EventSource`. A true single socket needs a `SharedWorker` (or the leader relaying every event over `BroadcastChannel`, which loses per-tab `Last-Event-ID` precision). Move `RealtimeClient` behind a `SharedWorker` and have followers subscribe to the worker's port. |
| 2 | **Offline queue for content mutations (remaining)** | Task creates and task-comment creates are wired (see update above). Message send is deliberately untouched — it already has its own optimistic local-echo + retry-with-backoff + manual-retry UX in `matrix-client.ts`, a different and already-reasonable architecture, not a "built but unused" gap. Folding it into the generic queue, and building real optimistic-UI rendering for the two mutations that are wired, remain open. |
| 3 | **Background file-upload continuation across navigation** | Uploads still abort when the channel view unmounts. Needs the upload to run off a store/worker rather than component state, then a progress surface fed from `useSyncStatus`-style state. |
| 4 | **Desktop main-process background sync** | `apps/desktop` still relies on the renderer being alive. A minimized/tray desktop app gets no background reconciliation. Options: keep a hidden renderer alive, or a small main-process poller for unread counts feeding the tray badge + native notifications. |
| 5 | **Service worker / Web Push** | No SW registered; no Web Push. `notification-service.ts` covers in-page + Electron native notifications only. A SW would also enable true background message sync on web. |
| 6 | **`web-version-indicator` cadence** | `libs/web/desktop/.../web-version-indicator.tsx` still polls `webMetadata` every 10 min unconditionally (it is not currently mounted anywhere in source). If it is re-mounted, gate its `refetchInterval` on `useSyncCadence('low')` — but its query key (`['web-version-meta']`) is not workspace-scoped, so it cannot be a `useBackgroundResource`. |
| 7 | **`MatrixProvider` 1s token poll** | `libs/web/chat/matrix-provider.tsx` keeps a `setInterval(…, 1000)` that only does a string compare of `getAccessToken()` and acts on change. Left as-is (negligible cost, load-bearing 401-storm backoff). Could be replaced with a `storage` + `visibilitychange` nudge. |
| 8 | **Per-channel unread parity** | Channel/DM unread still comes from `useLiveRoomActivity` (Matrix room counts) merged over the notification feed — unchanged. The `/sync/changes` digest reports *notification* rows, not per-Matrix-room read state. |
| 9 | **`e2e` scenarios from the brief §23** | The unit + service specs are in; the full end-to-end matrix (receive-while-elsewhere, DM-while-minimized, reconnect-after-failure, multi-tab, session-expiry, background upload, agent-response-after-navigation) needs `infra:start` + a running API + Playwright and was not run this pass. |
