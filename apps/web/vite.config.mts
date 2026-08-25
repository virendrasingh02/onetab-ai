import path from 'node:path';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Hostnames allowed to reach the dev server and the preview server through the
 * Host header. Vite rejects anything not listed, so every way we hand the app
 * to someone outside this machine has to be named here.
 *
 * `.trycloudflare.com` covers `cloudflared tunnel --url http://localhost:4200`
 * (the quick tunnel, whose subdomain is random per run); `.cfargotunnel.com`
 * covers a named tunnel addressed by its UUID. A tunnel routed at your own
 * domain also needs that domain added.
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
 * Pairs with `VITE_API_URL=/api/v1` in `apps/web/.env.local`: the client
 * calls a same-origin relative path instead of `http://localhost:3000`,
 * which would resolve to the *visitor's* machine over a shared tunnel.
 */
const API_PROXY = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
};

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/web',
  server: {
    port: 4200,
    strictPort: true,
    host: 'localhost',
    allowedHosts: TUNNEL_HOSTS,
    proxy: API_PROXY,
  },
  preview: {
    port: 4200,
    strictPort: true,
    host: 'localhost',
    // A shared preview build is reached through the same tunnel hostnames the
    // dev server uses, and preview enforces `allowedHosts` just as strictly.
    allowedHosts: TUNNEL_HOSTS,
    proxy: API_PROXY,
  },
  resolve: {
    /*
     * Every @org lib is an npm-workspace symlink, e.g. node_modules/@org/auth
     * pointing at libs/web/auth. With the default preserveSymlinks=false,
     * Vite resolves each lib's own imports relative to its real path under
     * libs/, while apps/web's imports resolve relative to apps/web/. Both
     * walk back up to the same root node_modules, but Rolldown keyed some of
     * what they found there as distinct instances: react-router's
     * NavigationContext and TanStack Query's QueryClientContext each came
     * back duplicated in production builds, so a component nested correctly
     * inside BrowserRouter/QueryClientProvider still read a null context from
     * the other copy (useNavigate() may be used only in the context of a
     * Router component; No QueryClient set) — a bug dev mode never showed,
     * since it never bundles. preserveSymlinks=true makes every lib resolve
     * relative to its symlinked path instead, which lines the two views back
     * up. See the node_modules check in manualChunks below for the half of
     * this that keeps chunking working.
     */
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(import.meta.dirname, '../../node_modules/react'),
      'react-dom': path.resolve(
        import.meta.dirname,
        '../../node_modules/react-dom',
      ),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    /**
     * matrix-js-sdk's Rust crypto ships as WebAssembly. Without this the E2EE
     * stack cannot load and every encrypted room renders a decryption
     * placeholder.
     *
     * No `vite-plugin-top-level-await` here: that package requires Rollup,
     * which Vite 8 no longer bundles (it builds with Rolldown), and the ES2022
     * build target supports top-level await natively regardless.
     */
    wasm(),
  ],
  optimizeDeps: {
    // Pre-bundling react and matrix-js-sdk ensures single React instance across packages.
    // prismjs is here for a different reason: its language-grammar files
    // (`prismjs/components/prism-*.js`) are plain scripts that assume a
    // `Prism` global already exists — they carry no import of their own.
    // Left to be dependency-optimized lazily on demand (the composer's
    // `@lexical/code-prism` and the media preview's text viewer both pull
    // these in independently), Vite can pre-bundle a component file as its
    // own isolated chunk before the core's global-setting side effect has
    // actually run, throwing "Prism is not defined". Including the core here
    // makes it part of the same eager, dev-server-startup pre-bundle pass as
    // everything else in this list, closing that ordering gap.
    include: ['react', 'react-dom', 'matrix-js-sdk', 'prismjs'],
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    // Gzipping every chunk just to print a number measurably slows CI builds.
    reportCompressedSize: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        /**
         * Split rarely-changing vendor code out of the app chunk so a feature
         * deploy does not invalidate the browser cache for all of React.
         *
         * Vite 8 bundles with Rolldown, which accepts only the function form
         * of `manualChunks` — the object form throws at config time.
         */
        manualChunks(id: string) {
          // `@org/*` libs are npm-workspace symlinks that `preserveSymlinks`
          // (above) resolves through `node_modules/@org/*` — they're this
          // app's own source, not a vendor dependency, so they still get
          // automatic per-route chunking instead of being swept into a
          // vendor bucket wholesale.
          if (
            !id.includes('node_modules') ||
            /[\\/]node_modules[\\/]@org[\\/]/.test(id)
          )
            return;
          if (
            // `@remix-run/router` is react-router-dom's own router/history
            // engine, published as a separate package it depends on — not
            // matched by the `react-router` patterns above it.
            /[\\/](react|react-dom|react-router|react-router-dom|@remix-run|scheduler)[\\/]/.test(
              id,
            )
          )
            return 'vendor-react';
          if (
            /[\\/](@tanstack|axios|zustand|@reduxjs|react-redux)[\\/]/.test(id)
          )
            return 'vendor-data';
          if (/[\\/](react-hook-form|@hookform|zod)[\\/]/.test(id))
            return 'vendor-forms';
          if (
            /[\\/](@radix-ui|lucide-react|framer-motion|sonner)[\\/]/.test(id)
          )
            return 'vendor-ui';
          // Matrix is large and versions independently of everything else, so
          // it gets its own chunk rather than invalidating the shared vendor.
          if (/[\\/](matrix-js-sdk|@matrix-org)[\\/]/.test(id))
            return 'vendor-matrix';
          return 'vendor';
        },
      },
    },
  },
  test: {
    name: '@org/web',
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
