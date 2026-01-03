import { tsconfigPathAliases } from './vite.renderer.config';
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
