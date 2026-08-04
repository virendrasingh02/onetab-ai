import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

/**
 * `globals: true` supplies `expect`, `vi` and `afterEach`.
 *
 * Importing them from 'vitest' here — or using the
 * `@testing-library/jest-dom/vitest` entry, which imports `expect` itself —
 * resolves a second vitest runtime under Nx's cwd on Windows, so the matchers
 * get registered on an instance the tests never see. Extending the global
 * `expect` keeps everything on one instance.
 */
expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// jsdom ships neither of these, and Radix primitives call both.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as unknown as typeof ResizeObserver;
}
