import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement ResizeObserver, but recharts' <ResponsiveContainer>
// (used by the admin dashboard's occupancy/revenue charts) requires it at
// mount time. Without this stub, any test that renders a populated chart
// throws an uncaught ResizeObserver-is-not-defined error from inside a
// passive effect, which silently unmounts the whole tree mid-test.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// Runs after every test to unmount rendered trees and avoid cross-test leakage.
afterEach(() => {
  cleanup();
});
