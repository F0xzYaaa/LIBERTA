// Type-only augmentation so vitest's `expect(...)` recognizes @testing-library/jest-dom
// matchers (toBeInTheDocument, etc). We deliberately do NOT install @types/jest (it would
// clash with vitest's own global `expect`/`describe` typings) -- instead we reach directly
// into jest-dom's jest-free `TestingLibraryMatchers` interface and merge it into vitest's
// `Assertion`/`AsymmetricMatchersContaining`, which is the supported jest-dom + vitest pattern
// for jest-dom versions that don't yet ship a dedicated `/vitest` entrypoint.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, void> {}
}
