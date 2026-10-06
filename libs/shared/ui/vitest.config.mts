import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@lobehub/ui/base-ui': path.resolve(
        import.meta.dirname,
        'src/lib/ai/lobe-ui-shim.js',
      ),
      '@lobehub/ui/icons': path.resolve(
        import.meta.dirname,
        'src/lib/ai/lobe-ui-shim.js',
      ),
      '@lobehub/ui': path.resolve(
        import.meta.dirname,
        'src/lib/ai/lobe-ui-shim.js',
      ),
      antd: path.resolve(
        import.meta.dirname,
        'src/lib/ai/lobe-ui-shim.js',
      ),
    },
  },
  test: {
    name: '@org/ui',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    server: {
      deps: {
        inline: ['@lobehub/icons', 'antd-style', 'antd', '@lobehub/ui'],
      },
    },
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
