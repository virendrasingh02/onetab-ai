import { defineConfig } from 'vitest/config';

// Unit tests cover the platform-free logic in src/lib (no React Native
// imports), so they run in plain Node alongside the rest of the workspace.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: '@org/mobile',
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
