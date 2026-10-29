#!/usr/bin/env node
/**
 * Puts the web app and Agent Studio running on this machine on public https
 * URLs through Cloudflare quick tunnels, so another computer or phone can use
 * them. No Cloudflare account, port forwarding or firewall change is needed.
 *
 *   npm run share                web + studio (and the API they call)
 *   npm run share -- web         web only
 *
 * What it does, in order:
 *
 * 1. Installs npm dependencies if node_modules is missing and copies
 *    .env.example to .env if there is no .env — so a fresh clone works.
 * 2. Finds `cloudflared` (PATH, the Windows installer's folder, or a copy
 *    cached under node_modules/.cache) and downloads the official release
 *    from GitHub into that cache when there is none.
 * 3. Opens one quick tunnel per app *before* building, because each app is
 *    built with the other's public URL: Studio sends signed-out visitors to
 *    the web app's sign-in page and the web app links back into Studio
 *    (VITE_WEB_APP_URL / VITE_STUDIO_APP_URL).
 * 4. Builds the apps and serves them with `vite preview` on their own ports
 *    (4300/4302), next to any dev servers you already run. Not the dev
 *    servers themselves: Vite dev serves ~1,700 separate module files per
 *    page load and quick tunnels rate-limit that (HTTP 429, blank page).
 *    The apps are built with VITE_API_URL=/api/v1, so the browser calls the
 *    API on the same tunnel origin and the preview server proxies /api to
 *    the local API — the API itself never gets a public URL.
 * 5. Starts the API through scripts/dev.mjs unless it is already running.
 *
 * Quick tunnel URLs are random and change every run. Ctrl+C stops everything.
 *
 * Flags:
 *   --public-links   also point the API's own links (emails, magic links,
 *                    OAuth/passkey origin: APP_URL, WEB_APP_URL) at the web
 *                    tunnel. Only applies when this script starts the API.
 *                    Off by default because it breaks passkeys and OAuth
 *                    callbacks registered for localhost.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { arch, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPS = {
  web: {
    project: '@org/web',
    dir: 'apps/web',
    port: 4300,
    label: 'Web app',
    env: 'VITE_WEB_APP_URL',
  },
  studio: {
    project: '@org/ai-agent-studio',
    dir: 'apps/ai-agent-studio',
    port: 4302,
    label: 'Agent Studio',
    env: 'VITE_STUDIO_APP_URL',
  },
};
const API_PORT = 3000;
const DEFAULT_APPS = ['web', 'studio'];

const READY_TIMEOUT_MS = 5 * 60_000; // a cold Nx build of the API is slow
const TUNNEL_TIMEOUT_MS = 60_000;

const repoRoot = realpathSync.native(
  join(dirname(fileURLToPath(import.meta.url)), '..'),
);
const isWindows = platform() === 'win32';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const publicLinks = args.includes('--public-links');
const requested = args
  .filter((arg) => !arg.startsWith('-'))
  .map((arg) => arg.toLowerCase());
const selected = requested.length ? requested : DEFAULT_APPS;
for (const name of selected) {
  if (!APPS[name]) {
    console.error(`Unknown app "${name}".\n`);
    printHelp();
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;
let interrupted = false;

// Ctrl+C already reaches every process in the console (Nx, Vite and
// cloudflared included), and dev.mjs explains why forwarding it on Windows
// orphans the servers. So only note it here; each child stops on its own.
for (const signal of ['SIGINT', 'SIGBREAK']) {
  process.on(signal, () => {
    interrupted = true;
  });
}
for (const signal of ['SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(1, signal));
}

for (const name of selected) {
  if (await isListening(APPS[name].port)) {
    console.error(
      `Port ${APPS[name].port} (${name}) is taken — is another \`npm run share\` running?`,
    );
    process.exit(1);
  }
}

ensureDependencies();
ensureEnvFile();

const cloudflared = await findOrInstallCloudflared();

console.log('\nOpening Cloudflare tunnels…');
const tunnels = {};
await Promise.all(
  selected.map(async (name) => {
    tunnels[name] = await openTunnel(cloudflared, APPS[name].port);
  }),
);

const env = {
  ...process.env,
  VITE_API_URL: '/api/v1',
  ...Object.fromEntries(
    selected.map((name) => [APPS[name].env, tunnels[name].url]),
  ),
};

buildApps();

if (await isListening(API_PORT)) {
  console.log(`\nReusing the API already running on :${API_PORT}.`);
  if (publicLinks) {
    console.warn(
      '! --public-links has no effect on an API that is already running.',
    );
  }
} else {
  const apiEnv = { ...env };
  if (publicLinks && tunnels.web) {
    apiEnv.APP_URL = tunnels.web.url;
    apiEnv.WEB_APP_URL = tunnels.web.url;
  }
  startChild(
    'API',
    process.execPath,
    [join(repoRoot, 'scripts/dev.mjs'), 'api', '--tui=false'],
    { env: apiEnv },
  );
}

for (const name of selected) {
  const app = APPS[name];
  startChild(
    app.label,
    process.execPath,
    [packageBin('vite'), 'preview', '--port', String(app.port), '--strictPort'],
    { cwd: join(repoRoot, app.dir), env },
  );
}

await waitForApps();

/** Installs npm dependencies on a fresh clone. */
function ensureDependencies() {
  if (existsSync(join(repoRoot, 'node_modules/nx/package.json'))) return;
  console.log(
    'node_modules is missing — running npm install (first run only)…\n',
  );
  // --legacy-peer-deps: the workspace's peer ranges do not all agree.
  const result = spawnSync('npm', ['install', '--legacy-peer-deps'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: isWindows,
  });
  if (result.status !== 0) {
    console.error('\nnpm install failed — fix the error above and run again.');
    process.exit(1);
  }
}

function ensureEnvFile() {
  const envPath = join(repoRoot, '.env');
  if (existsSync(envPath)) return;
  copyFileSync(join(repoRoot, '.env.example'), envPath);
  console.log(
    'Created .env from .env.example. Check DATABASE_URL and REDIS_URL point at ' +
      'a running Postgres/Redis (`npm run infra:start` starts both in Docker).\n',
  );
}

/**
 * Library deps go through Nx (cacheable), but the apps are built with Vite
 * directly: Nx does not hash the per-run tunnel URLs, so a cached app build
 * would come back with the previous run's links baked in.
 */
function buildApps() {
  const projects = selected.map((name) => APPS[name].project);
  console.log('\nBuilding libraries…');
  run(
    process.execPath,
    [packageBin('nx'), 'run-many', '-t', 'build-deps', '-p', ...projects],
    { cwd: repoRoot, env },
  );
  for (const name of selected) {
    console.log(`\nBuilding ${APPS[name].label}…`);
    run(process.execPath, [packageBin('vite'), 'build'], {
      cwd: join(repoRoot, APPS[name].dir),
      env: { ...env, NODE_ENV: 'production' },
    });
  }
}

function run(command, commandArgs, options) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    console.error('\nBuild failed — see the error above.');
    shutdown(1);
  }
}

/** A long-running server; if it dies on its own, everything stops. */
function startChild(label, command, commandArgs, options) {
  const child = spawn(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
  children.push(child);
  child.on('exit', (code) => {
    if (shuttingDown || interrupted) return;
    console.error(`\n! ${label} stopped (exit ${code}).`);
    shutdown(code || 1);
  });
}

/** The JS entry of a workspace dependency's CLI, run with this Node. */
function packageBin(pkg) {
  const require = createRequire(join(repoRoot, 'package.json'));
  const manifestPath = require.resolve(`${pkg}/package.json`);
  const { bin } = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return join(dirname(manifestPath), typeof bin === 'string' ? bin : bin[pkg]);
}

async function findOrInstallCloudflared() {
  const exe = isWindows ? 'cloudflared.exe' : 'cloudflared';
  const candidates = ['cloudflared'];
  if (isWindows) {
    for (const base of [
      process.env['ProgramFiles(x86)'],
      process.env.ProgramFiles,
    ]) {
      if (base) candidates.push(join(base, 'cloudflared', exe));
    }
  }
  const cacheDir = join(repoRoot, 'node_modules/.cache/cloudflared');
  const cached = join(cacheDir, exe);
  candidates.push(cached);

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }

  const asset = cloudflaredAsset();
  if (!asset) {
    console.error(
      `No cloudflared build for ${platform()}/${arch()}. Install it yourself: ` +
        'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    );
    process.exit(1);
  }

  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`;
  console.log(`cloudflared not found — downloading ${url}`);
  mkdirSync(cacheDir, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Download failed: HTTP ${response.status}.`);
    process.exit(1);
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  if (asset.endsWith('.tgz')) {
    // macOS ships a tarball holding a single `cloudflared` binary.
    const archive = join(cacheDir, asset);
    writeFileSync(archive, bytes);
    const untar = spawnSync('tar', ['-xzf', archive, '-C', cacheDir], {
      stdio: 'inherit',
    });
    rmSync(archive, { force: true });
    if (untar.status !== 0) process.exit(1);
  } else {
    const partial = `${cached}.partial`;
    writeFileSync(partial, bytes);
    renameSync(partial, cached);
  }
  if (!isWindows) chmodSync(cached, 0o755);
  console.log(`Saved to ${cached}\n`);
  return cached;
}

function cloudflaredAsset() {
  const cpu = { x64: 'amd64', arm64: 'arm64', ia32: '386', arm: 'arm' }[arch()];
  switch (platform()) {
    case 'win32':
      // Windows on ARM runs the amd64 build under emulation.
      return `cloudflared-windows-${cpu === '386' ? '386' : 'amd64'}.exe`;
    case 'linux':
      return cpu ? `cloudflared-linux-${cpu}` : null;
    case 'darwin':
      return cpu === 'arm64' || cpu === 'amd64'
        ? `cloudflared-darwin-${cpu}.tgz`
        : null;
    default:
      return null;
  }
}

/**
 * Starts a quick tunnel to a local port and resolves with its public URL.
 *
 * `--http-host-header` rewrites the Host header to localhost so Vite's
 * allowed-hosts check accepts tunnelled requests without a config change.
 * `--config` points at an empty file so a personal ~/.cloudflared/config.yml
 * (a named tunnel, say) cannot hijack the quick tunnel.
 */
function openTunnel(binary, port) {
  const emptyConfig = join(
    repoRoot,
    'node_modules/.cache/cloudflared/quick-tunnel.yml',
  );
  mkdirSync(dirname(emptyConfig), { recursive: true });
  writeFileSync(emptyConfig, '');

  const child = spawn(
    binary,
    [
      'tunnel',
      '--no-autoupdate',
      '--config',
      emptyConfig,
      '--url',
      `http://localhost:${port}`,
      '--http-host-header',
      `localhost:${port}`,
    ],
    { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  children.push(child);

  return new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => {
      reject(
        new Error(`cloudflared gave no URL for :${port} within 60s.\n${log}`),
      );
    }, TUNNEL_TIMEOUT_MS);

    const onData = (chunk) => {
      log += chunk;
      const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolve({ url: match[0], child });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (shuttingDown || interrupted) return;
      if (!log.includes('trycloudflare.com')) {
        reject(
          new Error(
            `cloudflared exited (${code}) before opening a tunnel.\n${log}`,
          ),
        );
      } else {
        console.error(
          `\n! The tunnel for :${port} closed (cloudflared exit ${code}).`,
        );
      }
    });
  }).catch((error) => {
    console.error(`\n${error.message}`);
    shutdown(1);
  });
}

/** Waits for the local servers, then for each tunnel to serve, then prints the links. */
async function waitForApps() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const ports = [API_PORT, ...selected.map((name) => APPS[name].port)];
  while (!shuttingDown) {
    const up = await Promise.all(ports.map(isListening));
    if (up.every(Boolean)) break;
    if (Date.now() > deadline) {
      console.warn(
        '\n! Servers are still starting after 5 minutes — links below may not work yet.',
      );
      break;
    }
    await delay(2000);
  }
  if (shuttingDown) return;

  const apiHealthy = await fetch(`http://localhost:${API_PORT}/api/v1/health`)
    .then((response) => response.ok)
    .catch(() => false);

  // A fresh trycloudflare hostname can take a few seconds to resolve.
  await Promise.all(selected.map((name) => waitForTunnel(tunnels[name].url)));
  if (shuttingDown) return;

  const width = Math.max(...selected.map((name) => APPS[name].label.length));
  const lines = selected.map(
    (name) => `  ${APPS[name].label.padEnd(width)}  ${tunnels[name].url}`,
  );
  console.log(
    [
      '',
      '──────────────────────────────────────────────────────────────',
      ' Onetab AI is shared — open these on any device:',
      '',
      ...lines,
      '',
      ' The URLs change every run. Anyone with a link can reach the app.',
      ' Code changes need a re-run (this serves a build, not live reload).',
      ' Press Ctrl+C to stop.',
      '──────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
  if (!apiHealthy) {
    console.warn(
      '! The API health check failed — is the database up? ' +
        '(`npm run infra:start`, then `npm run db:deploy`)\n',
    );
  }
}

async function waitForTunnel(url) {
  const deadline = Date.now() + TUNNEL_TIMEOUT_MS;
  while (!shuttingDown && Date.now() < deadline) {
    const ok = await fetch(url, { signal: AbortSignal.timeout(5000) })
      .then((response) => response.status < 500)
      .catch(() => false);
    if (ok) return;
    await delay(2000);
  }
}

function shutdown(code, signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal ?? 'SIGTERM');
  }
  process.exit(code);
}

/** Same probe as dev.mjs: the servers bind different loopback families. */
function isListening(port) {
  const probe = (host) =>
    new Promise((resolve) => {
      const socket = connect({ port, host });
      const done = (result) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(500, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });

  return Promise.all([probe('127.0.0.1'), probe('::1')]).then((results) =>
    results.some(Boolean),
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp() {
  console.log(
    [
      'Usage: npm run share -- [apps...] [--public-links]',
      '',
      'Apps:',
      ...Object.entries(APPS).map(
        ([name, app]) =>
          `  ${name.padEnd(6)}  ${app.label} (served on :${app.port})`,
      ),
      '',
      `With no apps: ${DEFAULT_APPS.join(' ')}. The API starts too unless it is running.`,
      '',
      'Flags:',
      '  --public-links   point API-generated links (emails, magic links) at the',
      '                   web tunnel instead of localhost',
      '',
    ].join('\n'),
  );
}
