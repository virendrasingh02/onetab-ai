#!/usr/bin/env node
/**
 * One entry point for the dev servers.
 *
 *   npm run dev                      API + web
 *   npm run dev:all                  API + web + admin + studio
 *   npm run dev -- api admin         exactly the apps named
 *   npm run dev -- all desktop       everything, plus the Electron shell
 *
 * Why a script rather than one `nx run-many -p …` line per combination:
 *
 * - A port that is already taken is reused, not fought over. In dev the API
 *   walks on to the next free port (3001, 3002…) while every Vite proxy stays
 *   pointed at :3000, so a second API would quietly serve nobody and the apps
 *   would keep talking to the first one. The Vite apps use `strictPort` and
 *   would take the whole run down instead. Either way the useful thing is to
 *   leave what is already listening alone and say so.
 * - `desktop` loads http://localhost:4200, so asking for it brings `web`.
 * - The apps live in one table below instead of in a package.json script per
 *   combination, which drifted every time an app was added.
 *
 * Any `--flag` that is not ours goes to Nx (`npm run dev -- --tui=false`).
 * Give Nx flags their value with `=`; a bare word is read as an app name.
 */
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPS = {
  api: {
    project: '@org/api',
    port: 3000,
    url: 'http://localhost:3000/api/v1',
  },
  web: { project: '@org/web', port: 4200, url: 'http://localhost:4200' },
  admin: { project: '@org/admin', port: 4201, url: 'http://localhost:4201' },
  studio: {
    project: '@org/ai-agent-studio',
    port: 4202,
    url: 'http://localhost:4202',
  },
  desktop: { project: '@org/desktop', url: 'Electron window', needs: ['web'] },
};

const GROUPS = { all: ['api', 'web', 'admin', 'studio'] };
const DEFAULT_APPS = ['api', 'web'];

// Same reason as scripts/run-vitest.mjs: keep the drive letter's casing
// canonical so nothing downstream sees two spellings of one path.
const repoRoot = realpathSync.native(
  join(dirname(fileURLToPath(import.meta.url)), '..'),
);

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const nxArgs = args.filter((arg) => arg.startsWith('-'));
const requested = args.filter((arg) => !arg.startsWith('-'));

const selected = resolveApps(requested.length ? requested : DEFAULT_APPS);
const busy = new Set();
await Promise.all(
  selected.map(async (name) => {
    const { port } = APPS[name];
    if (port && (await isListening(port))) busy.add(name);
  }),
);
const toStart = selected.filter((name) => !busy.has(name));

printPlan(selected, busy);

if (toStart.length === 0) {
  console.log('Everything asked for is already running.\n');
  process.exit(0);
}

const projects = toStart.map((name) => APPS[name].project);
const nxCommand =
  projects.length === 1
    ? ['run', `${projects[0]}:serve`]
    : ['run-many', '-t', 'serve', '-p', ...projects];

const nx = spawn(process.execPath, [nxBin(), ...nxCommand, ...nxArgs], {
  cwd: repoRoot,
  stdio: 'inherit',
});

// Ctrl+C reaches every process in the console, Nx included, and Nx has to
// outlive us long enough to stop its servers — so only swallow it here.
// Forwarding it would be worse on Windows, where `kill()` is a hard
// TerminateProcess that orphans every server Nx started. Signals aimed at
// this process alone (a closed terminal, a process manager) are passed on.
process.on('SIGINT', () => {});
process.on('SIGBREAK', () => {});
for (const signal of ['SIGTERM', 'SIGHUP']) {
  process.on(signal, () => nx.kill(signal));
}

nx.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

/** Expands groups, pulls in dependencies, and keeps the table's order. */
function resolveApps(names) {
  const wanted = new Set();
  const byProject = Object.fromEntries(
    Object.entries(APPS).map(([name, app]) => [app.project, name]),
  );

  const add = (name) => {
    if (wanted.has(name)) return;
    wanted.add(name);
    for (const dependency of APPS[name].needs ?? []) add(dependency);
  };

  for (const raw of names) {
    const name = raw.toLowerCase();
    if (GROUPS[name]) GROUPS[name].forEach(add);
    else if (APPS[name]) add(name);
    else if (byProject[raw]) add(byProject[raw]);
    else {
      console.error(`Unknown app "${raw}".\n`);
      printHelp();
      process.exit(1);
    }
  }

  return Object.keys(APPS).filter((name) => wanted.has(name));
}

/**
 * True when something accepts connections on the port. Probes both loopback
 * families because the servers do not agree on one: web and admin bind
 * `localhost` (::1 first on Windows), the studio binds every interface.
 */
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

function nxBin() {
  const require = createRequire(join(repoRoot, 'package.json'));
  const manifestPath = require.resolve('nx/package.json');
  const { bin } = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return join(dirname(manifestPath), typeof bin === 'string' ? bin : bin.nx);
}

function printPlan(names, alreadyRunning) {
  const width = Math.max(...names.map((name) => name.length));
  console.log('\nOneTab AI dev servers\n');
  for (const name of names) {
    const { url, port } = APPS[name];
    const note = alreadyRunning.has(name)
      ? `  (already running on :${port}, reusing it)`
      : '';
    console.log(`  ${name.padEnd(width)}  ${url}${note}`);
  }
  console.log('');
}

function printHelp() {
  const width = Math.max(...Object.keys(APPS).map((name) => name.length));
  const appLines = Object.entries(APPS).map(([name, app]) => {
    const where = app.port ? `:${app.port}` : app.url;
    const needs = app.needs ? `, brings ${app.needs.join(', ')}` : '';
    return `  ${name.padEnd(width)}  ${app.project} (${where}${needs})`;
  });
  const groupLines = Object.entries(GROUPS).map(
    ([name, members]) => `  ${name.padEnd(width)}  ${members.join(' ')}`,
  );

  console.log(
    [
      'Usage: npm run dev -- [apps...] [nx flags]',
      '',
      'Apps:',
      ...appLines,
      '',
      'Groups:',
      ...groupLines,
      '',
      `With no apps: ${DEFAULT_APPS.join(' ')}.`,
      'An app whose port is already in use is reused, not started again.',
      '',
      'Examples:',
      '  npm run dev -- api admin',
      '  npm run dev -- all desktop',
      '  npm run dev -- web --tui=false',
      '',
    ].join('\n'),
  );
}
