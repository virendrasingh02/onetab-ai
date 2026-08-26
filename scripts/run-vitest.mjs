#!/usr/bin/env node
/**
 * Runs Vitest for one project with the project directory spelled the way the
 * filesystem spells it.
 *
 * On Windows the drive letter's case follows whoever launched the process: a
 * shell gives `D:\…`, Nx gives `d:\…`. Vitest keys its module registry by
 * absolute path, so when the two spellings meet in one run the worker cannot
 * find its own runner and specs fail to collect with either "Vitest failed to
 * find the runner"/"...the current suite" or "Cannot read properties of
 * undefined (reading 'config')" — before a single test body executes.
 *
 * `realpathSync.native` returns the canonical on-disk casing, so spawning
 * from there makes `nx test <project>` behave exactly like running `vitest`
 * by hand. It is a no-op on macOS and Linux, where the path is already
 * canonical.
 *
 * Usage: node scripts/run-vitest.mjs <project-root-relative-to-repo> [vitest args...]
 * Invoked with `cwd: "{workspaceRoot}"` from each project's `test` target.
 *
 * Remove this once Vitest compares Windows paths case-insensitively.
 */
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = realpathSync.native(
  join(dirname(fileURLToPath(import.meta.url)), '..'),
);

const [projectRelativeRoot, ...forwardedArgs] = process.argv.slice(2);
if (!projectRelativeRoot) {
  console.error(
    'Usage: node scripts/run-vitest.mjs <project-root-relative-to-repo> [vitest args...]',
  );
  process.exit(1);
}

const projectRoot = realpathSync.native(join(repoRoot, projectRelativeRoot));
const vitestBin = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');

const vitest = spawn(
  process.execPath,
  [vitestBin, 'run', '--passWithNoTests', ...forwardedArgs],
  { cwd: projectRoot, stdio: 'inherit' },
);

vitest.on('exit', (code, signal) => {
  // A signalled exit reports a null code; turn it into a failure rather than
  // letting the task look like it passed.
  process.exit(code ?? (signal ? 1 : 0));
});
