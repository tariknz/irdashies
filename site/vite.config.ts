import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
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
      '@irdashies/types': path.resolve(__dirname, '../src/types'),
      // Ensure single copy of React — parent project components must use
      // the same React instance as the site app
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(
        __dirname,
        'node_modules/react/jsx-runtime'
      ),
      'react/jsx-dev-runtime': path.resolve(
        __dirname,
        'node_modules/react/jsx-dev-runtime'
      ),
      // Ensure single copy of react-router-dom — parent project components
      // (e.g. SettingsLoader) use useParams from the same instance as the
      // site's MemoryRouter
      'react-router-dom': path.resolve(
        __dirname,
        'node_modules/react-router-dom'
      ),
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
