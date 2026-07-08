import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts (used by the prod build) so the test runner's
// config can evolve independently and `tsc --noEmit` (which type-checks
// vite.config.ts per tsconfig's `include`) never has to know about `test:`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Generous ceiling: this dev machine runs many jsdom environments in
    // parallel, and RTL + fake/real timer mixes can occasionally exceed the
    // 5s default under load even when the underlying logic is fast.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportOnFailure: true,
      include: [
        'src/lib/**',
        'src/api/client.ts',
        'src/context/AuthContext.tsx',
        'src/routes/RequireAuth.tsx',
      ],
    },
  },
});
