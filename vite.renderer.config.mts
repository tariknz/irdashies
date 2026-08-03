import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import tsconfig from './tsconfig.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const tsconfigPathAliases = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions?.paths || {}).map(([key, values]) => {
    let value = values[0];

    if (key.endsWith('/*')) {
      key = key.slice(0, -2);
      value = value.slice(0, -2);
    }

    return [key, path.resolve(configDirectory, value)];
  })
);

// https://vitejs.dev/config
export default defineConfig({
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: tsconfigPathAliases,
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(configDirectory, 'index.html'),
        'dashboard-view': path.resolve(
          configDirectory,
          'index-dashboard-view.html'
        ),
        'hid-host': path.resolve(configDirectory, 'index-hid-host.html'),
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    sourcemap: false,
  },
});
