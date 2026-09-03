#!/usr/bin/env node
/**
 * Copies the `en` locale of `emojibase-data` into a web app's `public/` so the
 * emoji picker (frimousse) fetches its dataset from our own origin instead of a
 * third-party CDN — required for the desktop shell and locked-down deployments,
 * and faster everywhere else.
 *
 * frimousse reads `${emojibaseUrl}/${locale}/${file}.json`; `<EmojiPicker>`
 * defaults `emojibaseUrl` to `/emojibase`, so the files land at
 * `<publicDir>/emojibase/en/`.
 *
 * Usage: node scripts/sync-emojibase.mjs [publicDir]   (default: apps/web/public)
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const publicDir = resolve(repoRoot, process.argv[2] ?? 'apps/web/public');
const srcEnDir = join(dirname(require.resolve('emojibase-data/package.json')), 'en');
const destEnDir = join(publicDir, 'emojibase', 'en');

if (!existsSync(srcEnDir)) {
  console.error(`[sync-emojibase] emojibase-data not found at ${srcEnDir}`);
  process.exit(1);
}

mkdirSync(destEnDir, { recursive: true });
// Only the raw JSON — frimousse fetches `compact.json`, `messages.json` and
// `shortcodes/*.json` at runtime. The package's `.json.d.ts` siblings would
// otherwise land in a lint/typecheck path they don't belong in.
cpSync(srcEnDir, destEnDir, {
  recursive: true,
  filter: (src) => !src.endsWith('.d.ts'),
});
console.log(`[sync-emojibase] ${srcEnDir} -> ${destEnDir} (json only)`);
