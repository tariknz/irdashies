import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';

const APP_LOGGER = path.resolve(__dirname, '../src/app/logger.ts');
const LOGGER_STUB = path.resolve(__dirname, 'src/shims/logger.ts');

/**
 * The preview reuses the app's processors, which log through the Electron
 * main-process logger. Swap that module for a browser-safe console logger --
 * see src/shims/logger.ts for why it crashes otherwise.
 */
function stubAppLogger(): Plugin {
  return {
    name: 'stub-app-logger',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || source === LOGGER_STUB) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (!resolved) return null;
      const file = path.resolve(resolved.id.split('?')[0]);
      return file === APP_LOGGER ? LOGGER_STUB : null;
    },
  };
}

export default defineConfig({
  plugins: [stubAppLogger(), react()],
  define: {
    // The preview runs main-process code in the browser, and some of it reads
    // process.env. The production build already compiles that to `{}`; this
    // makes the dev server behave the same instead of throwing.
    'process.env': '{}',
  },
  server: {
    // Use a dedicated port so the site dev server doesn't clash with the
    // main app's renderer dev server (electron-forge vite plugin on 5173).
    port: 5174,
    fs: {
      allow: [
        // Allow serving files from the parent project
        path.resolve(__dirname, '..'),
      ],
    },
  },
  resolve: {
    alias: {
      '@irdashies/utils': path.resolve(__dirname, '../src/frontend/utils'),
      '@irdashies/context': path.resolve(__dirname, '../src/frontend/context'),
      '@irdashies/domain': path.resolve(__dirname, '../src/frontend/domain'),
      '@irdashies/types': path.resolve(__dirname, '../src/types'),
      '@irdashies/shared': path.resolve(__dirname, '../src/shared'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
