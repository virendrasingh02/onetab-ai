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
    },
  },
  test: {
    name: '@org/web-chat',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
