// Metro config for an Expo app inside the npm-workspaces monorepo.
const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

// Canonical on-disk casing: on Windows the drive letter otherwise follows
// whoever launched the process (`D:` vs `d:`), and Metro then refuses files it
// resolved under one spelling but watches under the other.
const projectRoot = fs.realpathSync.native(__dirname);
const workspaceRoot = fs.realpathSync.native(
  path.resolve(projectRoot, '../..'),
);

const config = getDefaultConfig(projectRoot);

// Watch the shared libraries (`@org/api-client`, `@org/types`, …) so edits there
// hot-reload, and resolve packages from the app first, then the hoisted root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

/*
 * The web apps run React 19.2.8 (hoisted at the root); React Native 0.88 ships a
 * renderer built for exactly 19.3.0, which npm therefore nests under this app.
 * Packages hoisted at the root (react-native itself, react-query, expo-router)
 * would otherwise resolve the root copy and end up with two Reacts. Pin every
 * `react` import in the bundle to the app's copy — and `react-dom` too, for the
 * web target (react-native-web), since React DOM refuses to start against a
 * React of a different version.
 */
const appPackageDir = (name) =>
  path.dirname(
    require.resolve(`${name}/package.json`, { paths: [projectRoot] }),
  );
const pinned = ['react-dom', 'react'].map((name) => [
  name,
  appPackageDir(name),
]);

/*
 * npm links workspace packages (`@org/api-client`, `@org/types`, …) into
 * node_modules as symlinks — junctions on Windows, which Metro's file map does
 * not follow. Resolve them to their real folder and `main` source entry.
 */
const workspacePackages = new Map();
function readWorkspaceEntry(name) {
  try {
    const manifest = require.resolve(`${name}/package.json`, {
      paths: [projectRoot],
    });
    const dir = fs.realpathSync.native(path.dirname(manifest));
    const { main } = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
    );
    return path.join(dir, main ?? 'src/index.ts');
  } catch {
    return null;
  }
}
function workspaceEntry(name) {
  if (!workspacePackages.has(name)) {
    workspacePackages.set(name, readWorkspaceEntry(name));
  }
  return workspacePackages.get(name);
}

const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;

  if (/^@org\/[^/]+$/.test(moduleName)) {
    const entry = workspaceEntry(moduleName);
    if (entry) return { type: 'sourceFile', filePath: entry };
  }

  for (const [name, dir] of pinned) {
    if (moduleName === name || moduleName.startsWith(`${name}/`)) {
      const target = path.join(dir, moduleName.slice(name.length));
      return resolve(context, target, platform);
    }
  }

  // The shared libraries are TypeScript compiled with NodeNext resolution, so
  // their relative imports name the emitted `.js` file (`./http.js`) while the
  // source on disk is `.ts`. Fall back to the extensionless path for those.
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    !context.originModulePath.includes(`${path.sep}node_modules${path.sep}`)
  ) {
    try {
      return resolve(context, moduleName, platform);
    } catch {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
