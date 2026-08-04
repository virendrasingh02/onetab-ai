import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: '@org/matrix-client',
    globals: true,
    // jsdom: the client touches localStorage, navigator.mediaDevices and Blob.
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    server: {
      deps: {
        // matrix-js-sdk ships ESM with directory imports, which Node cannot
        // resolve on its own. Inlining lets Vite resolve them — the same job
        // the app bundler does in production.
        inline: ['matrix-js-sdk'],
      },
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
