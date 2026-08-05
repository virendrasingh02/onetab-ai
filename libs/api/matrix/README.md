# @org/api-matrix

Server-side Matrix integration: identity provisioning, the appservice bridge and
the push gateway.

## Design

Matrix is the communication engine; it is not the source of truth. The browser
never holds a Matrix password — it exchanges our session for a short-lived Matrix
login token, and every privileged operation (creating users, creating rooms,
setting power levels) goes through the admin service using the appservice token.

Business data stays in our database. The bridge writes only what powers our own
features: `RecentActivity` rows and notification fan-out. Message content is not
duplicated.

The whole module is optional. `MATRIX_ENABLED=false` (the default) leaves the API
fully functional and `GET /matrix/config` reports `enabled: false`, so the client
knows not to attempt a connection.

## Surface

- `MatrixModule` — registers both controllers and the four services.
- `GET /matrix/config` — whether chat is available, and the server name.
- `POST /matrix/session` — exchanges our session for Matrix credentials
  (homeserver URL, Matrix user id, login token).
- `POST /matrix/channels/:channelId/room` — creates or returns the room backing
  a channel.
- `PUT /matrix/appservice/transactions/:txnId` — event batches from Synapse.
- `POST /matrix/appservice/notify` — push gateway endpoint.
- `MatrixAdminService` — `provisionUser`, `createLoginToken`, `createRoom`,
  `inviteToRoom`, `kickFromRoom`, `setPowerLevel`.
- `MatrixAuthService` — `ensureIdentity`, `issueClientCredentials`,
  `linkChannelToRoom`, `syncChannelMembership`.
- `MatrixSyncService` — `handleTransaction`.
- `NotificationBridgeService` — `handlePush`.
- `matrixEnvSchema`, `readMatrixConfig`, `toMatrixUserId`, `toMatrixLocalpart`.

## Notes

**Appservice endpoints are `@Public()`** because the caller is Synapse, not a
user. They authenticate with `MATRIX_HS_TOKEN` instead.

**Transactions must return 200 even for events we ignore.** Any other status
makes Synapse retry the transaction indefinitely and stall the bridge.

**The push gateway returns `rejected` pushkeys.** That is the contract: it is how
the homeserver learns to stop sending to a device that has gone away.

**Identity is provisioned lazily.** `ensureIdentity` creates the Matrix account on
first use via the registration shared secret and stores `matrixUserId` on our
`User`, so the mapping is ours rather than derived at every call site.

## Configuration

| Variable                            | Purpose                              |
| ----------------------------------- | ------------------------------------ |
| `MATRIX_ENABLED`                    | Master switch; defaults to `false`   |
| `MATRIX_HOMESERVER_URL`             | Required when enabled                |
| `MATRIX_SERVER_NAME`                | Required when enabled                |
| `MATRIX_REGISTRATION_SHARED_SECRET` | Provisioning users                   |
| `MATRIX_AS_TOKEN`                   | Our calls to the homeserver          |
| `MATRIX_HS_TOKEN`                   | Authenticates the homeserver to us   |

## Commands

```sh
nx test @org/api-matrix
nx lint @org/api-matrix
nx typecheck @org/api-matrix
```
