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
      '@org/common': path.resolve(
        import.meta.dirname,
        '../../shared/common/src/index.ts',
      ),
      '@org/ui': path.resolve(
        import.meta.dirname,
        '../../shared/ui/src/index.ts',
      ),
      '@org/utils': path.resolve(
        import.meta.dirname,
        '../../shared/utils/src/index.ts',
      ),
      '@org/types': path.resolve(
        import.meta.dirname,
        '../../shared/types/src/index.ts',
      ),
      '@org/web-desktop': path.resolve(
        import.meta.dirname,
        '../desktop/src/index.ts',
      ),
      '@org/notifications': path.resolve(
        import.meta.dirname,
        '../notifications/src/index.ts',
      ),
    },
  },
  test: {
    name: '@org/web-workspace',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
