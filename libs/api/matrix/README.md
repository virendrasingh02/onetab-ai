# @org/api-matrix

Server-side Matrix integration: identity provisioning, the appservice bridge and
the push gateway.

## Design

Matrix is the communication engine; it is not the source of truth. The browser
never holds a Matrix password — it exchanges our session for a Matrix access
token minted on its behalf, and every privileged operation (creating users,
creating rooms, setting power levels) goes through the admin service.

There are two ways to hold those privileges, and the bridge supports both:

- **Server admin** (`MATRIX_USERNAME` + `MATRIX_PASSWORD`, optionally
  `MATRIX_ADMIN_TOKEN`). Everything runs through the Synapse admin API, so it
  works against any reachable homeserver with nothing installed on it. The
  bridge cannot masquerade, so it borrows a user's own session — minted through
  the admin API — to create a room, and the room's creator to invite or kick.
  Synapse pushes no events to us, so the appservice endpoints stay idle.
- **Appservice** (`MATRIX_AS_TOKEN` + `MATRIX_HS_TOKEN` +
  `MATRIX_REGISTRATION_SHARED_SECRET`). Needs registration files installed on
  the homeserver, and in exchange the homeserver pushes events to
  `/matrix/appservice/*`, which is what drives `RecentActivity` and
  notification fan-out.

Admin credentials win when both are configured.

Business data stays in our database. The bridge writes only what powers our own
features: `RecentActivity` rows and notification fan-out. Message content is not
duplicated.

The whole module is optional. `MATRIX_ENABLED=false` (the default) leaves the API
fully functional and `GET /matrix/config` reports `enabled: false`, so the client
knows not to attempt a connection.

## Surface

- `MatrixModule` — registers both controllers and the four services.
- `GET /matrix/config` — whether chat is available, whether it is encrypted,
  the server name, the homeserver URL and the caller's Matrix id (null until
  provisioned). The last two let a browser resume a stored session instead of
  minting a new one.
- `POST /matrix/session` — exchanges our session for Matrix credentials
  (homeserver URL, Matrix user id, access token, device id). An empty device id
  means the session cannot do end-to-end encryption.
- `POST /matrix/channels/:channelId/room` — creates or returns the room backing
  a channel.
- `PUT /matrix/appservice/transactions/:txnId` — event batches from Synapse.
- `POST /matrix/appservice/notify` — push gateway endpoint.
- `MatrixAdminService` — `provisionUser`, `createUserSession`, `createRoom`,
  `inviteToRoom`, `kickFromRoom`, `setPowerLevel`.
- `MatrixAuthService` — `ensureIdentity`, `getIdentity`,
  `issueClientCredentials`, `linkChannelToRoom`, `syncChannelMembership`.
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
first use and stores `matrixUserId` on our `User`, so the mapping is ours rather
than derived at every call site.

**Encryption costs a login.** Only `POST /login` issues a device-bound access
token, and only a device-bound token can upload encryption keys. Synapse
rate-limits that endpoint per source address — and every user's login leaves
from this one process — so the stock `rc_login` allows about five sessions and
then one every few minutes for the whole deployment. Either relax `rc_login` on
the homeserver or set `MATRIX_ENCRYPTION=false`, which switches sessions to the
admin API (unlimited, no device, no crypto) and creates private rooms
unencrypted to match.

## Configuration

| Variable                              | Purpose                                           |
| ------------------------------------- | ------------------------------------------------- |
| `MATRIX_ENABLED`                      | Master switch; defaults to `false`                |
| `MATRIX_HOMESERVER_URL`               | Required when enabled (`MATRIX_HOMESERVER` works) |
| `MATRIX_SERVER_NAME`                  | Required when enabled                             |
| `MATRIX_ENCRYPTION`                   | Encrypt private rooms; defaults to `true`         |
| `MATRIX_USERNAME` / `MATRIX_PASSWORD` | A server admin, for admin-API mode                |
| `MATRIX_ADMIN_TOKEN`                  | That admin's token, to skip the boot login        |
| `MATRIX_USER_PASSWORD_SECRET`         | Salt for derived per-user passwords               |
| `MATRIX_REGISTRATION_SHARED_SECRET`   | Provisioning users, appservice mode               |
| `MATRIX_AS_TOKEN`                     | Our calls to the homeserver, appservice mode      |
| `MATRIX_HS_TOKEN`                     | Authenticates the homeserver to us                |

## Commands

```sh
nx test @org/api-matrix
nx lint @org/api-matrix
nx typecheck @org/api-matrix
```
