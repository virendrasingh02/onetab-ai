# Realtime connection & delivery audit — 2026-10-22

Scope: the platform's own realtime transport (`@org/api-realtime` SSE gateway + `@org/realtime` client).
Chat messages are **not** in scope for deliver-then-delete: they ride Matrix, which keeps history by
design and already has durable sync tokens, local-echo acks (txnId) and per-room read receipts.

## What already worked (kept as-is)
- **Lightweight per-connection handlers**: each SSE connection is one rxjs `Subject` in a Map. No process or thread per connection.
- Ticket handshake (no raw JWT in the URL) and a membership check at connect time.
- A per-event `WorkspaceMember ACTIVE` re-check on every workspace broadcast.
- Cross-node fan-out over Redis pub/sub, and a workspace replay buffer keyed by `lastEventId`.
- Client: reconnect with exponential backoff plus jitter, a heartbeat watchdog, de-duplication by event id, and isolation of failing subscribers.

## Broken / missing — fixed
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | The Redis subscriber called `void dispatchLocalWorkspaceBroadcast()`. A rejected membership query became an **unhandled rejection**, which crashes the Node process. One DB blip would drop every user on the node. | High | Added `.catch` with logging. |
| 2 | The SSE `finalize(async …)` called `presence.removeConnection` (a Prisma write). If it rejected, the rejection was unhandled. One user's disconnect error could crash the node. | High | Teardown is now synchronous, and the presence write is caught. |
| 3 | Event ids were minted **per node**. A client that reconnected to another node presented a cursor that node had never seen, so it got the whole 300-event replay under ids it could not de-duplicate. | Medium | The id is minted once before fan-out. |
| 4 | User-targeted events (`notification.created`, `mention.created`) were fire-and-forget. They were lost for offline or reconnecting users, with no ack, retry or status. | High | Added a deliver-then-delete pipeline (below). |
| 5 | There was no connection cap, per-user cap or slow-consumer handling. A stalled socket buffered without limit in node memory. | Medium | Added a node cap (503), a per-user cap (the oldest connection is evicted) and stalled-socket eviction. |
| 6 | `presence.recordConnection` failing after `registerClient` leaked the registered client. | Low | The client is now unregistered on failure. |

## Deliver-then-delete design
- `PendingDeliveryService` keeps one hash per recipient (`rt:pending:<userId>`) in the existing `CacheService`, which is Redis or its in-memory fallback. New per-field-atomic hash ops were added: `hashSet` (Lua, with `onlyIfExists`), `hashGetAll`, `hashDel` and `hashLen`.
- `gateway.deliverToUser()` enqueues the event first, then pushes it. The frame carries `requiresAck: true`.
- The client acks after its handlers run. It batches and de-duplicates acks, retries a failed ack with backoff, and sends them to `POST /realtime/ack`. Only then is the payload deleted. Pushing to a socket alone is never treated as delivery.
- **Retry**: a 5s sweep covers only users that are connected locally and have pending entries. Delays use bounded exponential backoff with ±20% jitter, and entries are finalized as `failed` after `maxAttempts`. A late attempt record never brings back an acked entry.
- **Recovery**: on every new connection, all still-pending entries are flushed to it.
- **Expiry**: each entry has a `ttlMs` deadline and is finalized as `expired`. The hash key also has a Redis TTL.
- **Idempotency**: `event.id` is the key (`ntf_<notificationId>` for notifications), so a re-emitted domain event updates a single entry. The client de-duplicates by id.
- **Isolation**: storage is keyed by the authenticated user, so an ack or status read cannot touch another user's entries. Each user has a queue cap (`failed/queue_full` for new entries, with no eviction of pending ones). The sweep processes users in chunks with `allSettled`.
- **Observability**: `GET /realtime/deliveries/:id` returns `pending|delivered|expired|failed` for the recipient only. `GET /realtime/deliveries` returns the pending count. Status records contain no payload, and logs carry only ids, types and counts.

Config env (all optional):
- `REALTIME_DELIVERY_TTL_MS` (24h)
- `_MAX_ATTEMPTS` (8)
- `_RETRY_BASE_MS` (2s)
- `_RETRY_MAX_MS` (60s)
- `_MAX_PENDING_PER_USER` (500)
- `_STATUS_TTL_MS` (1h)
- `REALTIME_MAX_CONNECTIONS` (20000)
- `REALTIME_MAX_CONNECTIONS_PER_USER` (12)
- `REALTIME_MAX_BUFFERED_BYTES` (2MB)
- `REALTIME_DELIVERY_SWEEP_MS` (5s)

## Tests
- `pending-delivery.service.spec.ts` (12 tests): ack deletes the entry, offline survival, expiry, the backoff curve and cap, max attempts going to `failed`, no resurrection, dedup, cross-user isolation, queue cap, malformed ids, and no payload in status records.
- `realtime-delivery.spec.ts` (16 tests): offline flush followed by ack, redelivery on reconnect, retry and fail, stop on ack, expiry, duplicate domain events, no cross-user routing, a throwing socket, stalled-consumer eviction, a store failure for one user, the per-user cap, the 503 cap, no unhandled rejection, same ids across nodes, and a cross-node ack.
- The concurrency test opens **5,000 connections (1,000 users × 5 tabs)**. It runs a workspace fan-out, 1,000 reliable deliveries, verifies no cross-user leakage, acks everything and closes all connections, in about 160 ms total on the in-memory store.
- `realtime-client.spec.ts` (+2 tests): batched and de-duplicated acks, no ack for best-effort events, and ack retry.
- A mutation check confirmed that the unhandled-rejection and cross-node-id tests fail against the old code.

## Remaining limits
- The capacity figure is in-process, with in-memory storage and mock sockets. It is not a real-network load test, and Redis adds about 3 round trips per reliable delivery. The SSE tickets in `RealtimeTicketService` are still node-local, so behind a non-sticky load balancer the client falls back to `?token=`.
- Delivery is at-least-once, not exactly-once. A reload between handling an event and acking it can re-show it once, because the client's de-dup memory does not survive a reload. Notification UIs already key by notification id.
- In-memory fallback mode (no Redis) is single-node only. That matches the rest of `CacheService`.
- Only `notification.created` and `mention.created` are reliable. Other user events (`notification.read`, `settings.updated`) remain best-effort because the `@org/sync` catch-up digest reconciles them.
- If Redis flips between up and down mid-flight, pending entries can split between Redis and the fallback store. This is the same caveat as the existing cache.
