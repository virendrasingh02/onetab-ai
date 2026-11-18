/**
 * Builds the desktop installers.
 *
 *   nx package @org/desktop                 # every platform this machine can build
 *   nx package @org/desktop -- --win        # just Windows
 *   nx package @org/desktop -- --mac --linux
 *   nx package @org/desktop -- --linux --arm64   # override the configured archs
 *
 * What a host can build (electron-builder's own limits, not ours):
 *   Windows → Windows
 *   macOS   → macOS, Linux
 *   Linux   → Linux
 * macOS installers can only be produced (and signed/notarised) on a Mac, and the
 * Windows/Linux cross builds need wine/fpm toolchains we do not assume. Asking for
 * a target the host cannot build fails up front with that explanation instead of
 * halfway through. `.github/workflows/desktop-release.yml` builds all three on
 * their native runners.
 *
 * Why this is a script and not a bare `electron-builder` call:
 *
 * - **Electron binary per target.** Packaging used to point `electronDist` at
 *   `node_modules/electron/dist` unconditionally. That folder holds the *host's*
 *   Electron, so a macOS arm64 build on an Intel Mac, or a Linux build on a Mac,
 *   would have shipped the wrong binary. The hook below reuses the installed copy
 *   only when the target platform and arch match the host (keeping the Windows
 *   virus-scanner `EPERM` workaround), and lets electron-builder download the
 *   matching zip for everything else.
 * - **Update feed.** With `ONETAB_UPDATE_URL` set this adds a `generic` publish
 *   provider at that URL, so electron-builder itself writes the `app-update.yml`
 *   electron-updater needs on every platform, alongside `latest*.yml`.
 * - **Runtime config.** `write-config.mjs` runs first, so the installer carries
 *   the production API/web/update URLs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(desktopRoot, '..', '..');

const PLATFORMS = /** @type {const} */ (['win', 'mac', 'linux']);
const HOST_PLATFORM = { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform];
/** Which targets each host can build without extra toolchains. */
const BUILDABLE_FROM = {
  win: ['win'],
  mac: ['mac', 'linux'],
  linux: ['linux'],
};
const ARCH_FLAGS = ['x64', 'arm64', 'ia32', 'armv7l', 'universal'];
/** electron-builder's names for `process.platform`. */
const ELECTRON_PLATFORM = { win32: 'win32', darwin: 'darwin', linux: 'linux' };

export function parseArgs(argv) {
  const platforms = new Set();
  const archs = new Set();
  let dir = false;
  for (const raw of argv) {
    const flag = raw.replace(/^--?/, '');
    if (flag === 'all') PLATFORMS.forEach((p) => platforms.add(p));
    else if (flag === 'w' || flag === 'windows' || flag === 'win') platforms.add('win');
    else if (flag === 'm' || flag === 'macos' || flag === 'mac') platforms.add('mac');
    else if (flag === 'l' || flag === 'linux') platforms.add('linux');
    else if (ARCH_FLAGS.includes(flag)) archs.add(flag);
    else if (flag === 'dir') dir = true;
    else throw new Error(`Unknown option "${raw}". Use --win, --mac, --linux, --all, an arch (--x64/--arm64) or --dir.`);
  }
  return { platforms: [...platforms], archs: [...archs], dir };
}

/** Requested targets split into what this host builds and what it cannot. */
export function planTargets(requested, hostPlatform) {
  const buildable = BUILDABLE_FROM[hostPlatform] ?? [];
  if (requested.length === 0) return { build: [...buildable], skipped: [] };
  return {
    build: requested.filter((p) => buildable.includes(p)),
    skipped: requested.filter((p) => !buildable.includes(p)),
  };
}

/**
 * The installed Electron only when it is the binary the target needs; `null`
 * makes electron-builder download the right one.
 */
export function electronDistFor(target, host = { platform: process.platform, arch: process.arch }) {
  const matches =
    target.platformName === ELECTRON_PLATFORM[host.platform] && target.arch === host.arch;
  if (!matches) return null;
  const dist = join(workspaceRoot, 'node_modules', 'electron', 'dist');
  return existsSync(dist) ? dist : null;
}

function absoluteHttpUrl(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString().replace(/\/+$/, '')
      : undefined;
  } catch {
    return undefined;
  }
}

export function buildConfig(base, { updateUrl } = {}) {
  const config = { ...base, electronDist: (options) => electronDistFor(options) };
  if (updateUrl) {
    // electron-builder now writes `app-update.yml` itself (same provider, URL and
    // `onetab-ai-updater` cache folder), so the hand-written copy is not shipped twice.
    config.publish = [{ provider: 'generic', url: updateUrl }];
    config.extraResources = (base.extraResources ?? []).filter(
      (entry) => typeof entry !== 'object' || !String(entry.from).endsWith('app-update.yml'),
    );
  }
  return config;
}

async function main() {
  const { platforms, archs, dir } = parseArgs(process.argv.slice(2));
  if (!HOST_PLATFORM) throw new Error(`Packaging is not supported on ${process.platform}.`);

  const { build: targets, skipped } = planTargets(platforms, HOST_PLATFORM);
  for (const platform of skipped) {
    console.warn(
      `[desktop] Skipping ${platform}: it cannot be built on ${HOST_PLATFORM}. ` +
        `Build it on a ${platform === 'mac' ? 'Mac' : platform === 'win' ? 'Windows' : 'Linux or macOS'} machine, ` +
        'or run the "Desktop release" GitHub workflow, which builds every platform.',
    );
  }
  if (targets.length === 0) process.exit(1);

  const webIndex = join(workspaceRoot, 'apps', 'web', 'dist', 'index.html');
  if (!existsSync(webIndex)) {
    throw new Error(`No web bundle at ${relative(workspaceRoot, webIndex)} — run \`nx build @org/web\` first.`);
  }

  const writeConfig = spawnSync(process.execPath, [join(desktopRoot, 'scripts', 'write-config.mjs')], {
    stdio: 'inherit',
    cwd: workspaceRoot,
  });
  if (writeConfig.status !== 0) process.exit(writeConfig.status ?? 1);

  const base = JSON.parse(readFileSync(join(desktopRoot, 'electron-builder.json'), 'utf8'));
  delete base.$schema;
  const config = buildConfig(base, { updateUrl: absoluteHttpUrl(process.env.ONETAB_UPDATE_URL) });

  // Without a signing identity on a Mac, don't go hunting the keychain for one —
  // an unsigned (ad-hoc) build is the honest result for a local/CI dry run.
  if (targets.includes('mac') && !process.env.CSC_LINK && !process.env.CSC_NAME) {
    process.env.CSC_IDENTITY_AUTO_DISCOVERY ??= 'false';
  }

  const { build } = await import('electron-builder');

  console.log(`[desktop] Packaging ${targets.join(', ')}${archs.length ? ` (${archs.join(', ')})` : ''}`);
  const artifacts = await build({
    projectDir: workspaceRoot,
    config,
    publish: 'never',
    // An empty list means "the targets in electron-builder.json"; `--dir` is the
    // unpacked app only, for a quick smoke test.
    ...Object.fromEntries(targets.map((platform) => [platform, dir ? ['dir'] : []])),
    // Arch flags replace the per-target `arch` lists in electron-builder.json.
    ...Object.fromEntries(archs.map((arch) => [arch, true])),
  });

  console.log('[desktop] Built:');
  for (const file of artifacts) console.log(`  ${relative(workspaceRoot, file)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`[desktop] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
