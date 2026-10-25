import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const APP_LOGGER = path.resolve(import.meta.dirname, '../src/app/logger.ts');
const LOGGER_STUB = path.resolve(import.meta.dirname, 'src/shims/logger.ts');
const APP_ICON_MAP = path.resolve(
  import.meta.dirname,
  '../src/frontend/utils/phosphorIconMap.ts'
);
const PREVIEW_ICON_MAP = path.resolve(
  import.meta.dirname,
  'src/shims/phosphorIconMap.ts'
);
const APP_TRACK_DATA = path.resolve(
  import.meta.dirname,
  '../src/frontend/domain/track/tracks/tracks.json'
);
const MOCK_SESSION = path.resolve(
  import.meta.dirname,
  '../src/app/irsdk/node/utils/mock-data/session.json'
);

/**
 * The preview reuses the app's processors, which log through the Electron
 * main-process logger. Swap that module for a browser-safe console logger --
 * see src/shims/logger.ts for why it crashes otherwise.
 */
function previewModules(): Plugin {
  return {
    name: 'preview-modules',
    enforce: 'pre',
    async load(id) {
      if (path.resolve(id.split('?')[0]) !== APP_TRACK_DATA) return null;
      // The demo drives one circuit. Keep its map while leaving the app's
      // complete track library out of the browser download.
      this.addWatchFile(APP_TRACK_DATA);
      this.addWatchFile(MOCK_SESSION);
      const [trackFile, sessionFile] = await Promise.all([
        readFile(APP_TRACK_DATA, 'utf8'),
        readFile(MOCK_SESSION, 'utf8'),
      ]);
      const tracks = JSON.parse(trackFile) as Record<string, unknown>;
      const session = JSON.parse(sessionFile) as {
        WeekendInfo: { TrackID: number };
      };
      const trackId = session.WeekendInfo.TrackID;
      if (!Object.hasOwn(tracks, trackId)) {
        throw new Error(`No track map for preview track ${trackId}`);
      }
      return JSON.stringify({ [trackId]: tracks[trackId] });
    },
    async resolveId(source, importer, options) {
      if (!importer || source === LOGGER_STUB) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (!resolved) return null;
      const file = path.resolve(resolved.id.split('?')[0]);
      if (file === APP_LOGGER) return LOGGER_STUB;
      if (file === APP_ICON_MAP) return PREVIEW_ICON_MAP;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [previewModules(), react()],
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
        path.resolve(import.meta.dirname, '..'),
      ],
    },
  },
  resolve: {
    alias: {
      '@irdashies/frontend': path.resolve(
        import.meta.dirname,
        '../src/frontend'
      ),
      '@irdashies/utils': path.resolve(
        import.meta.dirname,
        '../src/frontend/utils'
      ),
      '@irdashies/context': path.resolve(
        import.meta.dirname,
        '../src/frontend/context'
      ),
      '@irdashies/domain': path.resolve(
        import.meta.dirname,
        '../src/frontend/domain'
      ),
      '@irdashies/types': path.resolve(import.meta.dirname, '../src/types'),
      '@irdashies/shared': path.resolve(import.meta.dirname, '../src/shared'),
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
