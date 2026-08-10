/**
 * Runs Vitest with the project directory spelled the way the filesystem spells
 * it.
 *
 * On Windows the drive letter's case follows whoever launched the process: a
 * shell gives `D:\…`, Nx gives `d:\…`. Vitest keys its module registry by
 * absolute path, so when the two spellings meet in one run the worker cannot
 * find its own runner and every spec fails to collect with either
 * "Vitest failed to find the runner" or "Cannot read properties of undefined
 * (reading 'config')" — before a single test body executes.
 *
 * `realpathSync.native` returns the canonical on-disk casing, so spawning from
 * there makes `nx test @org/desktop` behave exactly like running `vitest` by
 * hand. It is a no-op on macOS and Linux, where the path is already canonical.
 *
 * Remove this once Vitest compares Windows paths case-insensitively.
 */
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = realpathSync.native(
  join(dirname(fileURLToPath(import.meta.url)), '..'),
);

const vitest = spawn(
  process.execPath,
  [
    join(projectRoot, '..', '..', 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    '--passWithNoTests',
    ...process.argv.slice(2),
  ],
  { cwd: projectRoot, stdio: 'inherit' },
);

vitest.on('exit', (code, signal) => {
  // A signalled exit reports a null code; turn it into a failure rather than
  // letting the task look like it passed.
  process.exit(code ?? (signal ? 1 : 0));
});
