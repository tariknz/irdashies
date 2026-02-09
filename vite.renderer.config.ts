import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import tsconfig from './tsconfig.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(path.dirname(__filename)); // __dirname is not used in ESM

// allow for path aliases in tsconfig.json to be used in Vite
// will load the paths from tsconfig.json paths property and create an object with key value pairs
// See: https://github.com/vitejs/vite/issues/6828
export const tsconfigPathAliases = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions.paths).map(([key, values]) => {
    let value = values[0];
    if (key.endsWith('/*')) {
      key = key.slice(0, -2);
      value = value.slice(0, -2);
    }

    const nodeModulesPrefix = 'node_modules/';
    if (value.startsWith(nodeModulesPrefix)) {
      value = value.replace(nodeModulesPrefix, '');
    } else {
      value = path.join(__dirname, value);
    }

    return [key, value];
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
        main: path.resolve(__dirname, 'index.html'),
        'dashboard-view': path.resolve(__dirname, 'index-dashboard-view.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-d3': ['d3'],
          'vendor-icons': ['@phosphor-icons/react'],
          'vendor-utils': ['zustand', 'use-sync-external-store'],
        },
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
