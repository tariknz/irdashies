import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    testTimeout: 10_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          dir: 'src/app',
          environment: 'node',
          // Native addon tests need their own process.
          pool: 'forks',
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          // Reuse jsdom per worker while keeping each test file isolated.
          pool: 'vmThreads',
          setupFiles: ['./vitest.setup.ts'],
          // Local extracted apps, archived checkouts and captures are not tests
          // for this checkout (and can contain copies of every source spec).
          exclude: [
            ...configDefaults.exclude,
            'src/app/**',
            'tmp-data/**',
            'perf-results/**',
          ],
        },
      },
    ],
  },
});
