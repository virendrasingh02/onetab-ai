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
      '@org/api-client': path.resolve(
        import.meta.dirname,
        '../api-client/src/index.ts',
      ),
      '@org/types': path.resolve(import.meta.dirname, '../types/src/index.ts'),
    },
  },
  test: {
    name: '@org/realtime',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
