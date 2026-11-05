import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so the app build never loads the test runner.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
