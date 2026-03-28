import { tsconfigPathAliases } from './vite.paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: tsconfigPathAliases,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
