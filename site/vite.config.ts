import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // Use a dedicated port so the site dev server doesn't clash with the
    // main app's renderer dev server (electron-forge vite plugin on 5173).
    port: 5174,
    fs: {
      allow: [
        // Allow serving files from the parent project
        path.resolve(siteRoot, '..'),
      ],
    },
  },
  resolve: {
    alias: {
      '@irdashies/utils': path.resolve(siteRoot, '../src/frontend/utils'),
      '@irdashies/context': path.resolve(siteRoot, '../src/frontend/context'),
      '@irdashies/types': path.resolve(siteRoot, '../src/types'),
      '@irdashies/shared': path.resolve(siteRoot, '../src/shared'),
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
