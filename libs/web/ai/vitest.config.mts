import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: '@org/web-ai',
    globals: true,
    // The suite here covers the composer's `@`/`/` parsing, which is pure
    // functions over text. Component tests would need jsdom; add it when there
    // are some.
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './test-output/vitest/coverage',
    },
  },
});
