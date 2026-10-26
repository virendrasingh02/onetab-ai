import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    server: { deps: { inline: [/@radix-ui/, /@floating-ui/, /simplebar/, /cmdk/, /vaul/, /sonner/, /frimousse/, /lucide-react/, 'react', 'react-dom', 'use-sync-external-store'] } },
    name: '@org/web-agents',
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
