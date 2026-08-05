# @org/matrix-client

The application's only door to Matrix. Wraps `matrix-js-sdk` behind a domain API.

## Design

Nothing from `matrix-js-sdk` crosses this package boundary — no `MatrixEvent`,
`Room` or `MatrixClient`. Consumers receive plain domain objects from
`@org/types` and one typed event stream, which is what makes the transport
replaceable without touching the rest of the app.

That promise is asserted, not just documented: `isolation.spec.ts` fails the
build if the barrel re-exports an SDK symbol, if a module outside the adapter set
imports the SDK (bare **or** deep specifier), or if a `catch` rethrows a raw SDK
error instead of normalising it through `MatrixError`.

Three modules are allowed to import the SDK: `matrix-client.ts`, `mappers.ts`
and `verification.ts`. Everything else works in domain types.

## Surface

- `createMatrixClient(options)` → `OneTabMatrixClient` — the factory, so callers
  never import the class or the SDK.
- `client.on(listener)` — the single `MatrixClientEvent` stream (connection,
  messages, typing, presence, receipts, threads, notifications, devices,
  verification, calls). One discriminated union, so consumers get exhaustive
  checking.
- **Session** — `login`, `loginWithToken`, `restore`, `logout`, `stop`,
  `getSession`, `isReady`, `getConnectionStatus`.
- **Rooms** — `getRooms`, `getRoom`, `getMembers`, `createRoom`,
  `getOrCreateDirectMessage`, `joinRoom`, `leaveRoom`, `inviteToRoom`.
- **Messages** — `getTimeline`, `loadOlderMessages`, `sendMessage`,
  `editMessage`, `deleteMessage`, `react`, `removeReaction`.
- **Threads** — `getThreads`, `getThreadMessages`.
- **Signals** — `setTyping`, `markRead`, `setPresence`, `getPresence`.
- **Media** — `sendFile` (image/video/audio/file, plus MSC3245 voice notes with
  a waveform), `resolveMedia` for `mxc://` URIs.
- **Devices & encryption** — `getDevices`, `deleteDevice`,
  `getEncryptionStatus`, `bootstrapCrossSigning`, `isRoomEncrypted`.
- **Verification** — `requestDeviceVerification`, `requestOwnUserVerification`,
  `requestUserVerification`, `acceptVerification`, `startVerificationSas`,
  `confirmVerification`, `rejectVerificationSas`, `cancelVerification`,
  `getVerification`, `getActiveVerifications`.
- **Push** — `registerPush`, `unregisterPush`, `getNotificationCounts`.
- `createCallManager(client)` → `CallManager` — voice/video foundation.
- `LocalStorageSessionStore` / `MemorySessionStore` — swappable persistence.
- `toMatrixError`, `isRetryable`, `withRetry` — error normalisation and
  exponential backoff with full jitter.

## Notes

**Errors.** Every SDK failure is mapped to a `MatrixError` carrying a
transport-neutral code (`INVALID_CREDENTIALS`, `SESSION_EXPIRED`, `FORBIDDEN`,
`NOT_FOUND`, `RATE_LIMITED`, `NETWORK`, `ENCRYPTION`, `UNSUPPORTED`, `UNKNOWN`).
A server-supplied `retry_after_ms` always wins over the computed backoff.

**Optimistic sends.** `sendMessage` emits a local echo immediately and
reconciles it on `LocalEchoUpdated` by transaction id, so the composer never
waits for a round trip.

**Decryption.** An encrypted event arrives with an empty body first; the client
re-emits `message.updated` once the keys land, so the placeholder is replaced in
place rather than appended.

**Verification** is flattened deliberately. The SDK spreads the flow across a
`VerificationRequest` (negotiation) and a `Verifier` (key exchange), with emoji
existing only on the second and only after keys are exchanged. Both collapse
into one `VerificationRequestSummary` with a single `phase`, so the UI never
learns that distinction. A mismatch calls `mismatch()` — sending
`m.mismatched_sas` — rather than a plain cancel, because the two mean different
things to the other side.

**Crypto imports come from a subpath.** `matrix-js-sdk` does not re-export
`crypto-api` from its root, so `CryptoEvent` and the verification enums are
imported from `matrix-js-sdk/lib/crypto-api/index.js`.

**Calls are a foundation, not a feature.** `CallManager` models real state and
acquires real media, then throws `UNSUPPORTED` where signalling would begin.
Matrix is mid-transition from legacy 1:1 calls (MSC2746) to MatrixRTC (MSC3401),
and committing to the legacy stack would mean rewriting it within a release.
Failing loudly beats pretending to connect.

## Commands

```sh
nx test @org/matrix-client
nx lint @org/matrix-client
nx typecheck @org/matrix-client
```
