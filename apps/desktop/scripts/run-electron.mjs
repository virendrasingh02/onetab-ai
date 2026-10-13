/**
 * Launches the desktop shell with a clean environment.
 *
 * `ELECTRON_RUN_AS_NODE=1` makes any Electron binary behave as plain Node: no
 * window, no built-in `electron` module, so the first `import { app }` resolves
 * to the npm package (a string with the binary's path) and the app dies with
 * "Cannot read properties of undefined (reading 'isPackaged')". Editors that are
 * themselves Electron apps — VS Code, Cursor, Windsurf — export it into their
 * integrated terminal, so `nx serve` from inside the editor hits this and a
 * plain OS terminal does not.
 *
 * Electron tests for the variable's *presence*, so it has to be deleted rather
 * than set to an empty string.
 *
 * Arguments are forwarded, so `nx serve @org/desktop -- --inspect` works.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// `require('electron')` outside an Electron process resolves to the path of the
// installed binary — which is exactly what we need to spawn.
let electronBinary;
try {
  electronBinary = require('electron');
} catch {
  console.error(
    'Electron is not installed. Run `npm install`, or `npm rebuild electron` if the postinstall download was skipped.',
  );
  process.exit(1);
}

if (typeof electronBinary !== 'string') {
  console.error('Unexpected `electron` resolution — expected a path to the binary.');
  process.exit(1);
}

/**
 * Dev-only: browsers label the "Open <app>?" protocol prompt with the exe's
 * FileDescription, which is "Electron" for the stock binary. Packaged builds
 * get "OneTab AI" from electron-builder; for dev we rewrite the stock binary's
 * version strings once, using the rcedit that electron-builder already caches.
 * Best-effort: any failure just leaves the old label.
 */
function brandDevBinary(binary) {
  if (process.platform !== 'win32') return;
  try {
    const marker = join(dirname(binary), '.onetab-branded');
    if (existsSync(marker)) return;
    const cache = join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache', 'winCodeSign');
    const rcedit = readdirSync(cache)
      .map((d) => join(cache, d, 'rcedit-x64.exe'))
      .find((p) => existsSync(p));
    if (!rcedit) return;
    const result = spawnSync(
      rcedit,
      [
        binary,
        '--set-version-string', 'FileDescription', 'OneTab AI',
        '--set-version-string', 'ProductName', 'OneTab AI',
        '--set-version-string', 'InternalName', 'OneTab AI',
      ],
      { stdio: 'ignore' },
    );
    if (result.status === 0) writeFileSync(marker, 'OneTab AI');
  } catch {
    // cosmetic only
  }
}

brandDevBinary(electronBinary);

const child = spawn(
  electronBinary,
  [join(projectRoot, 'dist', 'main.js'), ...process.argv.slice(2)],
  { env, stdio: 'inherit' },
);

child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
