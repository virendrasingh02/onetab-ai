import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Hostnames allowed to reach the dev server and the preview server through the
 * Host header — mirrors apps/web/vite.config.mts so the console can be shared
 * the same way the web app is. `.trycloudflare.com` covers `cloudflared
 * tunnel --url http://localhost:4201` (random subdomain per run);
 * `.cfargotunnel.com` covers a named tunnel addressed by its UUID. A tunnel
 * routed at your own domain also needs that domain added here.
 */
const TUNNEL_HOSTS = [
  'my-custom-domain.local',
  'host.docker.internal',
  '.ngrok-free.app',
  '.trycloudflare.com',
  '.cfargotunnel.com',
];

/**
 * A tunnel forwards exactly one local port, so the API has to be reachable
 * through that same port for a single tunnel URL to work end to end. This
 * proxies `/api/*` server-side to the locally running Nest API, which also
 * sidesteps CORS entirely — the browser only ever sees the tunnel origin.
 *
 * Pairs with `VITE_API_URL=/api/v1` in `apps/admin/.env.local`: the client
 * calls a same-origin relative path instead of `http://localhost:3000`,
 * which would resolve to the *visitor's* machine over a shared tunnel. See
 * apps/web/vite.config.mts for the full writeup.
 */
const API_PROXY = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
};

/**
 * Every @org/* package is a node_modules/@org/foo -> libs/**\/foo workspace
 * symlink. With preserveSymlinks: true below, Vite's optimizer can't tell
 * those apart from real node_modules dependencies and pre-bundles them,
 * caching the bundle by lockfile hash rather than the lib's own source — so
 * edits under libs/**\/src stop showing up until something clears
 * node_modules/.vite/admin (a full nx reset happens to do that, which is why
 * that "fixes" it). See apps/web/vite.config.mts for the full writeup.
 */
const ORG_WORKSPACE_PACKAGES = (() => {
  const orgModulesDir = path.resolve(
    import.meta.dirname,
    '../../node_modules/@org',
  );
  try {
    return fs.readdirSync(orgModulesDir).map((name) => `@org/${name}`);
  } catch {
    return [];
  }
})();

function workspaceLiveSourcePlugin() {
  return {
    name: 'vite-plugin-workspace-live-source',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';
        if (
          url.includes('/@org/') ||
          url.includes('node_modules/@org/') ||
          url.includes('/libs/') ||
          url.includes('/packages/')
        ) {
          res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          );
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        next();
      });
    },
    handleHotUpdate({ file, server }: any) {
      const normalized = file.replace(/\\/g, '/');
      if (normalized.includes('/libs/') || normalized.includes('/packages/')) {
        for (const [id, mod] of server.moduleGraph.idToModuleMap.entries()) {
          if (
            id.replace(/\\/g, '/').includes(normalized) ||
            (mod.file && mod.file.replace(/\\/g, '/').includes(normalized))
          ) {
            server.moduleGraph.invalidateModule(mod);
          }
        }
      }
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/admin',
  server: {
    port: 4201,
    strictPort: true,
    host: 'localhost',
    allowedHosts: TUNNEL_HOSTS,
    proxy: API_PROXY,
    watch: {
      ignored: ['!**/node_modules/@org/**', '!**/libs/**', '!**/packages/**'],
    },
  },
  preview: {
    port: 4201,
    strictPort: true,
    host: 'localhost',
    // A shared preview build is reached through the same tunnel hostnames the
    // dev server uses, and preview enforces `allowedHosts` just as strictly.
    allowedHosts: TUNNEL_HOSTS,
    proxy: API_PROXY,
  },
  resolve: {
    // Every @org lib resolves through its npm-workspace symlink
    // (node_modules/@org/foo -> libs/*/foo). Without preserveSymlinks, a
    // lib's own imports resolve relative to its real path under libs/ while
    // apps/admin's resolve relative to apps/admin/ — both reach the same
    // root node_modules, but Rolldown has bundled the two views as distinct
    // instances of a dependency's module (context-based singletons, e.g.
    // react-router's NavigationContext, come back duplicated, so a
    // correctly-nested consumer reads a null context from the other copy).
    // See apps/web/vite.config.mts for the full writeup — this app shares
    // the same lib graph and so the same exposure, even if not yet observed
    // here directly.
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(import.meta.dirname, '../../node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, '../../node_modules/react-dom'),
    },
  },
  plugins: [react(), tailwindcss(), workspaceLiveSourcePlugin()],
  optimizeDeps: {
    // use-sync-external-store/shim/with-selector.js is CJS-only and needs
    // esbuild's pre-bundling pass for its default-export interop — see
    // apps/web/vite.config.mts for the full writeup.
    //
    // `recharts` (behind @org/admin-analytics's charts, lazy-loaded off the
    // default `/overview` route) imports the *named* export
    // `useSyncExternalStoreWithSelector` from that same shim path
    // (recharts/es6/state/hooks.js). Left to be auto-discovered later —
    // recharts is only reachable through a `React.lazy()` boundary, so the
    // cold-start scan misses it — esbuild ends up pre-bundling the shim
    // twice, in two separate passes that don't agree on its shape: the
    // first (triggered by this file's own forced include, in isolation)
    // can't statically prove the shim re-exports that name, so it emits a
    // default-only chunk; recharts' later, on-demand pass then imports a
    // name that chunk never declared, and the browser's ESM loader throws
    // "does not provide an export named 'useSyncExternalStoreWithSelector'".
    // Listing `recharts` here too forces both into the *same* pre-bundle
    // pass from server start, so esbuild reconciles the shim's shape once.
    include: [
      'react',
      'react-dom',
      'use-sync-external-store/shim/with-selector.js',
      'recharts',
    ],
    // Keeps every @org/* lib off the pre-bundle path — see
    // ORG_WORKSPACE_PACKAGES above.
    exclude: ORG_WORKSPACE_PACKAGES,
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    reportCompressedSize: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requires the function form — see apps/web.
        manualChunks(id: string) {
          // @org libs resolve through node_modules/@org/* (preserveSymlinks
          // above) but are this app's own source, not a vendor dependency —
          // see apps/web/vite.config.mts.
          if (!id.includes('node_modules') || /[\\/]node_modules[\\/]@org[\\/]/.test(id)) return;
          if (/[\\/](react|react-dom|react-router|react-router-dom|@remix-run|scheduler)[\\/]/.test(id))
            return 'vendor-react';
          if (/[\\/](@tanstack|axios|zustand|@reduxjs|react-redux)[\\/]/.test(id)) return 'vendor-data';
          if (/[\\/](@radix-ui|lucide-react|framer-motion|sonner)[\\/]/.test(id))
            return 'vendor-ui';
          return 'vendor';
        },
      },
    },
  },
  test: {
    name: '@org/admin',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
}));
