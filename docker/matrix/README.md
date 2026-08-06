# Local Matrix homeserver

A throwaway Synapse for developing chat. It listens on `localhost:8008`, holds
no real data, and federates with nothing.

## Why the secrets are committed

`homeserver.yaml` and `dev-appservice.yaml` contain a registration shared secret
and two appservice tokens in plain text, and the same values appear in the
repository root `.env`. That is deliberate.

They authenticate a homeserver that is only reachable from the machine that
started it, and the three values have to agree across four files for the bridge
to work at all. Generating them per-developer would mean every checkout starts
with a broken chat feature and a manual synchronisation step. Production uses
different values, supplied by the environment — see the commented block at the
bottom of `.env.example`.

**Nothing here is valid anywhere else.** If you point `MATRIX_HOMESERVER_URL` at
a real homeserver, replace all three.

## Setup

```sh
npm run matrix:start     # boot Synapse (generates the signing key on first run)
npm run matrix:setup     # grant the appservice sender server-admin rights
```

The second step is not optional. `MatrixAdminService.createLoginToken` calls
`/_synapse/admin/v1/users/{id}/login`, and that endpoint checks _server admin_
rights rather than appservice rights — an appservice token alone gets a 403, so
`POST /matrix/session` fails and the browser never connects. Synapse has no API
for granting the first admin, so `scripts/matrix-dev-setup.mjs` sets the flag
directly in Synapse's database. It is idempotent.

Then:

```sh
npm run dev
```

Chat is on by default (`MATRIX_ENABLED="true"` in `.env`). Set it to `false` to
run the app without a homeserver — the API stays fully functional and
`GET /matrix/config` reports `enabled: false`.

## Commands

| Command                | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `npm run matrix:start` | Start the homeserver                        |
| `npm run matrix:setup` | Grant admin rights (run once after `start`) |
| `npm run matrix:logs`  | Follow Synapse's logs                       |
| `npm run matrix:stop`  | Stop the homeserver, keeping its data       |
| `npm run matrix:reset` | Stop and delete the volume — a clean server |

`npm run infra:start` brings the same homeserver up as part of the full stack.
Both compose files use the container name `onetab-matrix` and the volume
`onetab_synapse_data`, so they are two ways to start one server — run one or the
other, not both.

## Layout

```text
docker/matrix/
  docker-compose.yml           Synapse alone, plus the one-shot key generator
  synapse/
    homeserver.yaml            server config; secrets match the root .env
    dev-appservice.yaml        appservice registration; tokens match the .env
    log.config                 console logging
```

Config files are bind-mounted read-only, so they stay versioned. State — the
signing key, the SQLite database and uploaded media — lives in the
`onetab_synapse_data` volume, which `matrix:reset` discards.

## How the pieces connect

```text
browser                API                         Synapse
  │                     │                             │
  │ POST /matrix/session│                             │
  ├────────────────────►│ provisionUser (shared       │
  │                     │   secret, first use only)   │
  │                     ├────────────────────────────►│
  │                     │ createLoginToken (as_token, │
  │                     │   needs server admin)       │
  │                     ├────────────────────────────►│
  │◄────────────────────┤ homeserverUrl + loginToken  │
  │                     │                             │
  │ loginWithToken      │                             │
  ├─────────────────────┼────────────────────────────►│
  │                     │                             │
  │                     │◄────────────────────────────┤
  │                     │  PUT .../appservice/         events
  │                     │  transactions/{txnId}        (hs_token)
```

The browser never holds a Matrix password. The login token it receives is valid
for about a minute and is exchanged immediately.

## Troubleshooting

**`POST /matrix/session` returns 502.** The appservice sender is not an admin —
run `npm run matrix:setup`. If it still fails, Synapse has cached the old flag:
`npm run matrix:restart`.

**Synapse logs `Failed to push events to ...`.** Synapse cannot reach the API.
Transactions go to `host.docker.internal:3000`, so the API must be listening on
port 3000 — if it logged "Port 3000 is in use, trying 3001" at startup, stop
whatever holds 3000 and restart it, or update the `url` in
`dev-appservice.yaml` to match.

**`M_UNKNOWN_TOKEN` on startup.** `.env` and `dev-appservice.yaml` have drifted.
The tokens must be byte-identical, and Synapse must be restarted after the file
changes — it reads registrations only at boot.

**Chat says unavailable with no error.** `GET /api/v1/matrix/config` reports
what the API thinks: `enabled: false` means `MATRIX_ENABLED` is not `"true"` in
the environment the API actually loaded.
