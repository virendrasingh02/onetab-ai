import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: {
    // Force a single copy of each of these: with `deps.inline` pulling package
    // source, a second resolution creates a second module-level React context
    // (react-query's `QueryClientProvider` most visibly), so a provider in a
    // spec would not be seen by a hook in `@org/*` source.
    dedupe: ['react', 'react-dom', '@tanstack/react-query', 'react-router-dom'],
    alias: [
      { find: /^react$/, replacement: path.resolve(import.meta.dirname, '../../../node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(import.meta.dirname, '../../../node_modules/react-dom') },
      { find: /^react-dom\/client$/, replacement: path.resolve(import.meta.dirname, '../../../node_modules/react-dom/client') },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(import.meta.dirname, '../../../node_modules/react/jsx-runtime') },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(import.meta.dirname, '../../../node_modules/react/jsx-dev-runtime') },
      { find: /^@tanstack\/react-query$/, replacement: path.resolve(import.meta.dirname, '../../../node_modules/@tanstack/react-query') },
    ],
  },
  test: {
    name: '@org/web-layout',
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    server: {
      deps: {
        inline: true,
      },
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
