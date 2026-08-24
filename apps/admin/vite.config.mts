import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/admin',
  server: {
    port: 4201,
    strictPort: true,
    host: 'localhost',
  },
  preview: {
    port: 4201,
    strictPort: true,
    host: 'localhost',
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
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['react', 'react-dom'],
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
