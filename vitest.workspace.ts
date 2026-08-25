import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'libs/*/*/vitest.config.mts',
  'libs/*/vitest.config.mts',
  'apps/*/vitest.config.mts',
  'packages/*/vitest.config.mts',
]);
