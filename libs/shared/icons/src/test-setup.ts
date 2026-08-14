import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

// See `libs/shared/ui/src/test-setup.ts` — extending the global `expect` keeps
// the matchers on the same vitest runtime the tests actually run on.
expect.extend(matchers);

afterEach(() => {
  cleanup();
});
