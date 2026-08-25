import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(import.meta.dirname, '../../../node_modules/react'),
      'react-dom': path.resolve(
        import.meta.dirname,
        '../../../node_modules/react-dom',
      ),
      '@org/ui': path.resolve(import.meta.dirname, '../ui/src/index.ts'),
      '@org/types': path.resolve(import.meta.dirname, '../types/src/index.ts'),
      '@org/utils': path.resolve(import.meta.dirname, '../utils/src/index.ts'),
      '@org/media-preview': path.resolve(import.meta.dirname, './src/index.ts'),
    },
  },
  test: {
    name: '@org/media-preview',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    // `pdfjs-dist` sets up real worker-loading machinery at module-evaluation
    // time; the default thread-pool's vm-context isolation intermittently let
    // a real (unmocked) import of it leak into `pdf-viewer.spec.tsx` when the
    // whole suite ran together (never reproduced running that file alone).
    // Real OS-process isolation per file removes the whole class of risk.
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
