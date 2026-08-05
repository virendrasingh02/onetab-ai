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
          if (!id.includes('node_modules')) return;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return 'vendor-react';
          if (/[\\/](@tanstack|axios|zustand)[\\/]/.test(id)) return 'vendor-data';
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
