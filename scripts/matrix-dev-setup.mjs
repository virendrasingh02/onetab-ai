#!/usr/bin/env node
/**
 * Prepares the local Synapse so the API can actually drive it.
 *
 * Starting the container is not enough. `MatrixAdminService.createLoginToken`
 * calls `/_synapse/admin/v1/users/{id}/login` with `MATRIX_AS_TOKEN`, and that
 * endpoint checks *server admin*, not appservice, rights. An appservice token
 * alone gets a 403, `POST /matrix/session` fails, and chat never connects.
 *
 * Synapse has no API for granting the first admin — by design, since it would
 * be a privilege-escalation hole. So the flag is set directly on the appservice
 * sender user in Synapse's own database, which is the documented bootstrap
 * route. Running this twice is harmless.
 *
 * Usage: npm run matrix:setup
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const CONTAINER = process.env.MATRIX_CONTAINER ?? 'onetab-matrix';
const HOMESERVER = process.env.MATRIX_HOMESERVER_URL ?? 'http://localhost:8008';
const SERVER_NAME = process.env.MATRIX_SERVER_NAME ?? 'localhost';
/** Must match `sender_localpart` in docker/matrix/synapse/dev-appservice.yaml. */
const SENDER = `@onetab:${SERVER_NAME}`;
const AS_TOKEN =
  process.env.MATRIX_AS_TOKEN ??
  '21d3205d5b3f34f61adf8933ce22475096fd194643a6a871fef231422e3a7402';

const log = (message) => console.log(`  ${message}`);
const fail = (message) => {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
};

/** Polls `/_matrix/client/versions` until Synapse answers or we give up. */
async function waitForSynapse(attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${HOMESERVER}/_matrix/client/versions`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch {
      // Not up yet — the container takes ~15s on a cold start.
    }
    if (attempt === 1) log(`waiting for ${HOMESERVER} …`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail(
    `Synapse did not answer at ${HOMESERVER}.\n` +
      `    Start it first:  npm run matrix:start`,
  );
}

/**
 * Touching an authenticated endpoint with the appservice token makes Synapse
 * materialise the sender user, so the UPDATE below has a row to hit.
 */
async function ensureSenderExists() {
  const response = await fetch(
    `${HOMESERVER}/_matrix/client/v3/account/whoami?user_id=${encodeURIComponent(SENDER)}`,
    { headers: { Authorization: `Bearer ${AS_TOKEN}` } },
  );

  if (response.status === 401 || response.status === 403) {
    fail(
      `Synapse rejected MATRIX_AS_TOKEN.\n` +
        `    The token in .env must match as_token in\n` +
        `    docker/matrix/synapse/dev-appservice.yaml, and Synapse must have\n` +
        `    been restarted since that file last changed.`,
    );
  }
  if (!response.ok) {
    fail(`whoami failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Sets `admin = 1` on the sender row in Synapse's SQLite database.
 *
 * Run through the container's own Python because the image ships no sqlite3
 * CLI, and the database lives in a named volume with no host path.
 */
async function grantAdmin() {
  const python = `
import sqlite3, sys
db = sqlite3.connect('/data/homeserver.db')
cur = db.execute("UPDATE users SET admin = 1 WHERE name = ?", (${JSON.stringify(SENDER)},))
db.commit()
print('rows=%d' % cur.rowcount)
`.trim();

  try {
    const { stdout } = await exec('docker', [
      'exec',
      CONTAINER,
      'python',
      '-c',
      python,
    ]);
    return stdout.includes('rows=0') ? 0 : 1;
  } catch (error) {
    const detail = String(error.stderr ?? error.message ?? error);

    if (/No such container/i.test(detail)) {
      fail(
        `Container "${CONTAINER}" is not running.\n` +
          `    Start it first:  npm run matrix:start`,
      );
    }

    // A daemon that is not up reports a connection or API error rather than
    // anything about the container, and the raw text is a wall of pipe paths.
    if (
      /daemon|dockerDesktop|cannot find the file|connect: |500 Internal Server Error|ENOENT/i.test(
        detail,
      )
    ) {
      fail(
        `Docker is not available.\n` +
          `    Start Docker Desktop, then:  npm run matrix:start && npm run matrix:setup\n` +
          `    (On Windows the Linux engine needs WSL2 — 'wsl --install'.)`,
      );
    }

    fail(`Could not update the Synapse database:\n    ${detail}`);
  }
}

/** Confirms the grant took by calling an endpoint only an admin may call. */
async function verifyAdmin() {
  const response = await fetch(
    `${HOMESERVER}/_synapse/admin/v2/users?limit=1`,
    { headers: { Authorization: `Bearer ${AS_TOKEN}` } },
  );
  return response.ok;
}

async function main() {
  console.log('\n  OneTab AI — local Matrix setup\n');

  await waitForSynapse();
  log(`homeserver is up at ${HOMESERVER}`);

  await ensureSenderExists();
  log(`appservice sender ${SENDER} exists`);

  const updated = await grantAdmin();
  if (updated === 0) {
    // The user row is created lazily; give Synapse a moment and retry once.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await grantAdmin();
  }

  if (!(await verifyAdmin())) {
    fail(
      `${SENDER} still cannot use the admin API.\n` +
        `    Synapse caches the flag, so restart it:  npm run matrix:restart`,
    );
  }
  log(`${SENDER} is a server admin`);

  console.log(`
  Matrix is ready. Set MATRIX_ENABLED="true" in .env (already the
  default there) and start the app:

    npm run dev

  Chat appears on any channel once the API and web app are running.
`);
}

main().catch((error) => fail(String(error?.stack ?? error)));
