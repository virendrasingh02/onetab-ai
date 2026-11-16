/**
 * Compiles the main process. Sourcemaps follow the same rule as the other apps:
 * on for development, off for production unless `GENERATE_SOURCEMAP=true`.
 *
 * tsc only emits, it never removes, so a stale map from an earlier development
 * build is deleted here rather than left beside the production output.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceMap =
  process.env.NODE_ENV !== 'production' ||
  process.env.GENERATE_SOURCEMAP === 'true';

// Run tsc through node directly: no shell, so paths with spaces stay intact on Windows.
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc');

const result = spawnSync(
  process.execPath,
  [
    tscBin,
    '-b',
    join(root, 'tsconfig.app.json'),
    '--force',
    '--sourceMap',
    String(sourceMap),
    '--declarationMap',
    String(sourceMap),
  ],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);

if (!sourceMap) {
  const dist = join(root, 'dist');
  for (const entry of readdirSync(dist, { recursive: true })) {
    if (String(entry).endsWith('.map')) rmSync(join(dist, String(entry)));
  }
}
