import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: '@org/api-e2e',
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globalSetup: ['./src/support/global-setup.ts'],
    // Every file talks to one shared API instance whose rate limits and data
    // are global, so parallel files would make results order-dependent.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
