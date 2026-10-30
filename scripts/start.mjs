#!/usr/bin/env node
/**
 * One command from a cold machine to a running app.
 *
 *   npm start                        infra, then API + web
 *   npm start -- all                 infra, then API + web + admin + studio
 *   npm start -- --chat              also make sure Matrix is up and set up
 *   npm start -- --migrate           apply pending Prisma migrations first
 *   npm start -- --tunnel            infra, then web + studio on public
 *                                    Cloudflare URLs (scripts/share.mjs)
 *   npm start -- --tunnel web        tunnel the web app only
 *
 * Before handing off it:
 *
 * 1. Installs npm dependencies if node_modules is missing and copies
 *    .env.example to .env if there is no .env.
 * 2. Probes Postgres and Redis at the hosts in DATABASE_URL / REDIS_URL. Only
 *    when one of them is local and not answering does it run the Docker infra
 *    stack (`npm run infra:start`), then waits for the ports. A database you
 *    run some other way (a native install, `prisma dev`) is left alone.
 *    Redis is only checked when REDIS_URL is set: without it the API falls
 *    back to an in-memory cache.
 * 3. Optionally starts and bootstraps Matrix, and applies migrations.
 *
 * Then it hands off to scripts/dev.mjs (or scripts/share.mjs with --tunnel),
 * so app names and every other flag work exactly as they do there:
 * `npm start -- api admin --tui=false`, `npm start -- --tunnel --public-links`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { connect } from 'node:net';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OWN_FLAGS = ['--tunnel', '--chat', '--migrate', '--no-infra'];
const INFRA_COMPOSE = [
  '-f',
  'docker/docker-compose.yml',
  '-f',
  'docker/docker-compose.override.yml',
];
const MATRIX_COMPOSE = ['-f', 'docker/matrix/docker-compose.yml'];
const SERVICE_TIMEOUT_MS = 90_000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const repoRoot = realpathSync.native(
  join(dirname(fileURLToPath(import.meta.url)), '..'),
);
const isWindows = platform() === 'win32';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const tunnel = args.includes('--tunnel');
const chat = args.includes('--chat');
const migrate = args.includes('--migrate');
const skipInfra = args.includes('--no-infra');
const passThrough = args.filter((arg) => !OWN_FLAGS.includes(arg));

console.log(`\nOnetab AI — ${tunnel ? 'sharing over a tunnel' : 'dev'}\n`);

ensureDependencies();
ensureEnvFile();
const env = { ...readDotEnv(), ...process.env };

let infraStarted = false;
if (!skipInfra) await ensureInfra();
if (chat) await ensureMatrix();
if (migrate) {
  step('Applying database migrations');
  runOrExit(process.execPath, [packageBin('prisma'), 'migrate', 'deploy']);
}

const handOff = join(repoRoot, 'scripts', tunnel ? 'share.mjs' : 'dev.mjs');
const child = spawn(process.execPath, [handOff, ...passThrough], {
  cwd: repoRoot,
  stdio: 'inherit',
});

// Same reasoning as dev.mjs: Ctrl+C already reaches the whole console, and
// forwarding it on Windows hard-kills the child and orphans its servers.
process.on('SIGINT', () => {});
process.on('SIGBREAK', () => {});
for (const signal of ['SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

/** Starts the Docker infra stack when a local Postgres or Redis is down. */
async function ensureInfra() {
  const services = [
    service('Postgres', env.DATABASE_URL, 5432),
    service('Redis', env.REDIS_URL, 6379),
  ].filter(Boolean);

  const down = [];
  for (const svc of services) {
    if (await isListening(svc.port, svc.host)) {
      console.log(`  ✓ ${svc.name} is up on ${svc.host}:${svc.port}`);
    } else if (svc.local) {
      down.push(svc);
    } else {
      console.warn(
        `  ! ${svc.name} at ${svc.host}:${svc.port} is not answering — it is not local, so it is not started here.`,
      );
    }
  }
  if (down.length === 0) return;

  step(`Starting Docker infra (${down.map((svc) => svc.name).join(', ')} down)`);
  requireDocker();
  runOrExit('docker', ['compose', ...INFRA_COMPOSE, 'up', '-d']);
  infraStarted = true;

  for (const svc of down) {
    if (!(await waitForPort(svc.port, svc.host))) {
      console.error(
        `\n${svc.name} did not come up on ${svc.host}:${svc.port} within ${SERVICE_TIMEOUT_MS / 1000}s. ` +
          'Check `npm run infra:logs`, and that the port in .env matches the container.',
      );
      process.exit(1);
    }
    console.log(`  ✓ ${svc.name} is up on ${svc.host}:${svc.port}`);
  }
}

/** Starts Synapse if needed, then grants the appservice its admin flag. */
async function ensureMatrix() {
  const matrix = service('Matrix', env.MATRIX_HOMESERVER_URL, 8008);
  if (!matrix) return;
  const up = await isListening(matrix.port, matrix.host);
  if (!up && !infraStarted && matrix.local) {
    step('Starting Matrix');
    requireDocker();
    runOrExit('docker', ['compose', ...MATRIX_COMPOSE, 'up', '-d']);
  }
  step('Setting up Matrix');
  runOrExit(process.execPath, [join(repoRoot, 'scripts/matrix-dev-setup.mjs')]);
}

/** host/port of a service URL, or null when the variable is unset. */
function service(name, url, defaultPort) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^\[|\]$/g, '') || 'localhost';
    return {
      name,
      host,
      port: Number(parsed.port) || defaultPort,
      local: LOCAL_HOSTS.has(host),
    };
  } catch {
    console.warn(`  ! Could not parse the ${name} URL in .env — skipping its check.`);
    return null;
  }
}

function requireDocker() {
  const probe = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (probe.status === 0) return;
  console.error(
    '\nDocker is not running (or not installed), so Postgres/Redis cannot be started.\n' +
      'Start Docker Desktop and run this again, point DATABASE_URL / REDIS_URL at\n' +
      'servers you run yourself, or pass --no-infra to skip this check.',
  );
  process.exit(1);
}

function ensureDependencies() {
  if (existsSync(join(repoRoot, 'node_modules/nx/package.json'))) return;
  step('node_modules is missing — running npm install (first run only)');
  // --legacy-peer-deps: the workspace's peer ranges do not all agree.
  runOrExit('npm', ['install', '--legacy-peer-deps'], { shell: isWindows });
}

function ensureEnvFile() {
  const envPath = join(repoRoot, '.env');
  if (existsSync(envPath)) return;
  copyFileSync(join(repoRoot, '.env.example'), envPath);
  console.log('  Created .env from .env.example.');
}

/** Just enough of a .env parser to read the service URLs. */
function readDotEnv() {
  const values = {};
  const text = readFileSync(join(repoRoot, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    values[match[1]] = value;
  }
  return values;
}

function runOrExit(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    console.error(`\n\`${command} ${commandArgs.join(' ')}\` failed — see above.`);
    process.exit(result.status || 1);
  }
}

function packageBin(pkg) {
  const manifestPath = join(repoRoot, 'node_modules', pkg, 'package.json');
  const { bin } = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return join(dirname(manifestPath), typeof bin === 'string' ? bin : bin[pkg]);
}

async function waitForPort(port, host) {
  const deadline = Date.now() + SERVICE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isListening(port, host)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

/** Same probe as dev.mjs; for localhost both loopback families are tried. */
function isListening(port, host = 'localhost') {
  const hosts = LOCAL_HOSTS.has(host) ? ['127.0.0.1', '::1'] : [host];
  const probe = (target) =>
    new Promise((resolve) => {
      const socket = connect({ port, host: target });
      const done = (result) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(500, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  return Promise.all(hosts.map(probe)).then((results) => results.some(Boolean));
}

function step(message) {
  console.log(`\n→ ${message}…`);
}

function printHelp() {
  console.log(
    [
      'Usage: npm start -- [apps...] [flags]',
      '',
      'Checks dependencies, .env, Postgres and Redis (starting the Docker infra',
      'only if a local one is down), then runs the dev servers.',
      '',
      'Flags:',
      '  --tunnel     share web + studio on public Cloudflare URLs instead',
      '               (apps: web, studio; see `npm run share -- --help`)',
      '  --chat       start Matrix if it is down and run matrix:setup',
      '  --migrate    apply pending Prisma migrations before starting',
      '  --no-infra   skip the Postgres/Redis check',
      '',
      'Apps and any other flag go to scripts/dev.mjs (or share.mjs with --tunnel).',
      '',
      'Examples:',
      '  npm start',
      '  npm start -- all',
      '  npm start -- all --chat --migrate',
      '  npm start -- --tunnel',
      '  npm start -- --tunnel web --public-links',
      '',
    ].join('\n'),
  );
}
