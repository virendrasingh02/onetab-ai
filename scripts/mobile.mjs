#!/usr/bin/env node
/**
 * One entry point for the mobile app (apps/mobile, Expo).
 *
 *   npm run mobile                   Metro for the dev-client build on a phone
 *   npm run mobile:web               the same app in a browser (:8082)
 *   npm run mobile:android           build + install on an emulator / USB phone
 *
 * Why a script rather than `expo start` in apps/mobile:
 *
 * - The API URL depends on where the app runs, and getting it wrong is the
 *   usual "network error on sign-in". A phone needs this PC's LAN IP, the
 *   Android emulator needs 10.0.2.2, the browser needs localhost (the refresh
 *   cookie is same-site). The URL is worked out per mode and passed as an env
 *   var, which Expo lets win over apps/mobile/.env. `--use-env` keeps .env.
 * - The API is started too unless it is already listening on :3000. For a
 *   phone it is started on 0.0.0.0, since its default `localhost` is not
 *   reachable from another device.
 *
 * Flags:
 *   --api-url=<url>   use this API base (incl. /api/v1), e.g. a tunnel
 *   --use-env         take EXPO_PUBLIC_* from apps/mobile/.env as-is
 *   --no-api          do not start the API
 *   --tunnel          serve Metro through an Expo tunnel (phone off the LAN)
 * Anything else is passed to the Expo CLI.
 */
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const API_PORT = 3000;
const WEB_PORT = 4200;

const MODES = {
  device: {
    describe: 'dev-client build on a phone (same Wi-Fi)',
    expo: ['start', '--dev-client'],
    host: () => lanAddress(),
    apiOnAllInterfaces: true,
  },
  web: {
    describe: 'browser via react-native-web',
    expo: ['start', '--web', '--port', '8082'],
    host: () => 'localhost',
  },
  android: {
    describe: 'build + install on an Android emulator / USB phone',
    expo: ['run:android'],
    host: () => '10.0.2.2',
  },
  ios: {
    describe: 'build + install on the iOS simulator (macOS only)',
    expo: ['run:ios'],
    host: () => 'localhost',
  },
};

const repoRoot = realpathSync.native(
  join(dirname(fileURLToPath(import.meta.url)), '..'),
);
const mobileRoot = join(repoRoot, 'apps', 'mobile');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const flag = (name) => args.includes(`--${name}`);
const value = (name) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const OURS = ['--use-env', '--no-api', '--api-url='];

const modeName = args.find((arg) => !arg.startsWith('-')) ?? 'device';
const mode = MODES[modeName];
if (!mode) {
  console.error(`Unknown mode "${modeName}".\n`);
  printHelp();
  process.exit(1);
}
const expoArgs = args.filter(
  (arg) =>
    arg !== modeName && !OURS.some((ours) => arg === ours || arg.startsWith(ours)),
);

const host = mode.host();
if (!host) {
  console.error(
    'Could not find a LAN IP for this PC. Connect to Wi-Fi, or pass --api-url=<tunnel url>.',
  );
  process.exit(1);
}

const env = { ...process.env };
if (!flag('use-env')) {
  env.EXPO_PUBLIC_API_URL =
    value('api-url') ??
    process.env.EXPO_PUBLIC_API_URL ??
    `http://${host}:${API_PORT}/api/v1`;
  env.EXPO_PUBLIC_WEB_URL ??= `http://${host}:${WEB_PORT}`;
}

const apiRunning = await isListening('127.0.0.1', API_PORT).then(
  (v4) => v4 || isListening('::1', API_PORT),
);
const startApi = !flag('no-api') && !apiRunning;

console.log('\nOnetab AI mobile\n');
console.log(`  mode     ${modeName} (${mode.describe})`);
console.log(`  API URL  ${env.EXPO_PUBLIC_API_URL ?? '(from apps/mobile/.env)'}`);
console.log(
  `  API      ${
    apiRunning
      ? `already running on :${API_PORT}, reusing it`
      : startApi
        ? `starting${mode.apiOnAllInterfaces ? ' on 0.0.0.0' : ''}`
        : 'not started (--no-api)'
  }`,
);
console.log('');

if (apiRunning && mode.apiOnAllInterfaces && !value('api-url')) {
  if (!(await isListening(host, API_PORT))) {
    console.warn(
      `  ! The running API is not reachable on ${host}:${API_PORT}, so the phone cannot reach it either.\n` +
        `    Stop it and rerun this, or start it with HOST=0.0.0.0.\n`,
    );
  }
}

const children = [];

if (startApi) {
  const api = spawn(
    process.execPath,
    [join(repoRoot, 'scripts', 'dev.mjs'), 'api', '--tui=false'],
    {
      cwd: repoRoot,
      env: mode.apiOnAllInterfaces ? { ...process.env, HOST: '0.0.0.0' } : process.env,
      // Expo owns the keyboard (r = reload, QR, …); the API only logs.
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  for (const stream of [api.stdout, api.stderr]) {
    createInterface({ input: stream }).on('line', (line) =>
      console.log(`[api] ${line}`),
    );
  }
  children.push(api);
}

const expo = spawn(process.execPath, [expoBin(), ...mode.expo, ...expoArgs], {
  cwd: mobileRoot,
  env,
  stdio: 'inherit',
});
children.push(expo);

// Ctrl+C reaches every process in the console already; forwarding it would be
// a hard TerminateProcess on Windows that orphans the servers (see dev.mjs).
process.on('SIGINT', () => {});
process.on('SIGBREAK', () => {});
for (const signal of ['SIGTERM', 'SIGHUP']) {
  process.on(signal, () => children.forEach((child) => child.kill(signal)));
}

expo.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

/**
 * The address a phone on the same network would use: a private IPv4 on a
 * real adapter. Hyper-V/WSL/VPN/VM adapters come first on many Windows
 * machines and are unreachable from a phone, so they are skipped.
 */
function lanAddress() {
  const virtual = /vethernet|wsl|hyper-v|virtualbox|vmware|vbox|docker|tailscale|zerotier|loopback/i;
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      candidates.push(address.address);
    }
  }
  const rank = (ip) =>
    ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  return candidates.sort((a, b) => rank(a) - rank(b))[0];
}

function isListening(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function expoBin() {
  const require = createRequire(join(mobileRoot, 'package.json'));
  return join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
}

function printHelp() {
  const width = Math.max(...Object.keys(MODES).map((name) => name.length));
  console.log(
    [
      'Usage: npm run mobile -- [mode] [flags]',
      '',
      'Modes:',
      ...Object.entries(MODES).map(
        ([name, m]) => `  ${name.padEnd(width)}  ${m.describe}`,
      ),
      '',
      'With no mode: device.',
      '',
      'Flags:',
      '  --api-url=<url>   API base incl. /api/v1 (e.g. a cloudflared tunnel)',
      '  --use-env         use EXPO_PUBLIC_* from apps/mobile/.env unchanged',
      '  --no-api          do not start the API',
      '  --tunnel          Expo tunnel for Metro (phone not on the same Wi-Fi)',
      '  --clear           reset the Metro cache',
      '',
      'Examples:',
      '  npm run mobile',
      '  npm run mobile:web',
      '  npm run mobile -- --api-url=https://xyz.trycloudflare.com/api/v1 --tunnel',
      '',
    ].join('\n'),
  );
}
