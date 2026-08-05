import path from 'node:path';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/web',
  server: {
    port: 4200,
    strictPort: true,
    host: 'localhost',
  },
  preview: {
    port: 4200,
    strictPort: true,
    host: 'localhost',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(import.meta.dirname, '../../node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, '../../node_modules/react-dom'),
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
    include: ['react', 'react-dom', 'matrix-js-sdk'],
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
          if (!id.includes('node_modules')) return;
          if (
            /[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          )
            return 'vendor-react';
          if (/[\\/](@tanstack|axios|zustand)[\\/]/.test(id))
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
