import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const TUNNEL_HOSTS = [
  'my-custom-domain.local',
  'host.docker.internal',
  '.ngrok-free.app',
  '.trycloudflare.com',
  '.cfargotunnel.com',
];

const API_PROXY = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
};

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
  cacheDir: '../../node_modules/.vite/apps/ai-agent-studio',
  server: {
    port: 4202,
    host: true,
    allowedHosts: TUNNEL_HOSTS,
    proxy: API_PROXY,
    fs: {
      strict: false,
      allow: ['../..'],
    },
  },
  preview: {
    port: 4202,
    host: true,
    allowedHosts: TUNNEL_HOSTS,
    proxy: API_PROXY,
  },
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps: {
    exclude: ORG_WORKSPACE_PACKAGES,
  },
  plugins: [react(), tailwindcss(), workspaceLiveSourcePlugin()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@org/ai-agent-studio',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
