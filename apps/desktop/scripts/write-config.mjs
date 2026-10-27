/**
 * Bakes the production API, web and update URLs into the installer.
 *
 * The web bundle gets `VITE_API_URL` compiled in, but the Electron main process
 * (sign-in code exchange, token refresh, update check, background notifications)
 * never sees a Vite env — and an installed app has no shell environment to read
 * one from. Without this file it would talk to `http://localhost:3000`.
 *
 *   VITE_API_URL=https://api.example.com/api/v1 \
 *   ONETAB_WEB_URL=https://app.example.com \
 *   ONETAB_UPDATE_URL=https://downloads.example.com/desktop \
 *   nx package @org/desktop
 *
 * `ONETAB_UPDATE_URL` is the folder you upload `latest.yml`, the installer and
 * its `.blockmap` to; it turns on in-app update download and install. Without it
 * the app still tells people about updates (through the API) but sends them to
 * the installer's download page.
 *
 * With an update URL it also writes `app-update.yml`, which electron-builder ships
 * beside `app.asar` (see `extraResources`). electron-updater can *check* a feed
 * it was given at runtime, but refuses to *download* from one without this file
 * — it reads its cache folder name from it — so the check would work and the
 * "Update now" that follows would not.
 *
 * Nothing is written when none of the variables holds an absolute http(s) URL,
 * and a stale file from a previous package is removed, so a local build can
 * never ship another environment's endpoints.
 */
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const resources = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const file = join(resources, 'desktop-config.json');
const updateFile = join(resources, 'app-update.yml');
/** Must match the folder an installed build already uses, or a pending download is orphaned. */
const UPDATER_CACHE_DIR = 'onetab-ai-updater';

function absoluteUrl(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString().replace(/\/+$/, '')
      : undefined;
  } catch {
    return undefined; // e.g. the relative `/api/v1` the dev proxy uses
  }
}

const apiUrl = absoluteUrl(process.env.ONETAB_API_URL ?? process.env.VITE_API_URL);
const webUrl = absoluteUrl(process.env.ONETAB_WEB_URL);
const updateUrl = absoluteUrl(process.env.ONETAB_UPDATE_URL);

if (existsSync(file)) rmSync(file);
if (existsSync(updateFile)) rmSync(updateFile);
if (updateUrl) {
  writeFileSync(
    updateFile,
    [`provider: generic`, `url: ${updateUrl}`, `updaterCacheDirName: ${UPDATER_CACHE_DIR}`, ``].join('\n'),
  );
}

if (!apiUrl && !webUrl && !updateUrl) {
  console.warn(
    '[desktop] VITE_API_URL / ONETAB_WEB_URL / ONETAB_UPDATE_URL are not absolute URLs: the installer will fall back to http://localhost:3000/api/v1 and cannot install updates itself.',
  );
} else {
  writeFileSync(file, `${JSON.stringify({ apiUrl, webUrl, updateUrl }, null, 2)}\n`);
  console.log(
    `[desktop] Wrote desktop-config.json (api: ${apiUrl ?? '—'}, web: ${webUrl ?? '—'}, updates: ${updateUrl ?? '—'})`,
  );
}
