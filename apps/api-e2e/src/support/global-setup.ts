import { killPort, waitForPortOpen } from '@nx/node/utils';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

/**
 * Runs once before the whole suite. Start anything the app needs to run
 * (database, docker-compose, etc.) here, then wait for the API to accept
 * connections.
 */
export async function setup() {
  console.log('\nSetting up...\n');
  await waitForPortOpen(port, { host });
}

/** Runs once after the whole suite. Put clean up logic here. */
export async function teardown() {
  console.log('\nTearing down...\n');
  await killPort(port);
}
