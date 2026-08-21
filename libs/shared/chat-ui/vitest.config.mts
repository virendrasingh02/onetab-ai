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
      '@org/chat-ui': path.resolve(import.meta.dirname, './src/index.ts'),
    },
  },
  test: {
    name: '@org/chat-ui',
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
});
