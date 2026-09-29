import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import tsconfig from './tsconfig.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(path.dirname(__filename));

const tsconfigPathAliases = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions?.paths || {}).map(([key, values]) => {
    let value = values[0];

    if (key.endsWith('/*')) {
      key = key.slice(0, -2);
      value = value.slice(0, -2);
    }

    return [key, path.resolve(__dirname, value)];
  })
);

const readGitValue = (args: string[]): string => {
  try {
    return (
      execFileSync('git', args, {
        cwd: __dirname,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || 'unknown'
    );
  } catch {
    return 'unknown';
  }
};

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __GIT_COMMIT_NUMBER__: JSON.stringify(
      readGitValue(['rev-list', '--count', 'HEAD'])
    ),
    __GIT_COMMIT_HASH__: JSON.stringify(
      readGitValue(['rev-parse', '--short=8', 'HEAD'])
    ),
  },
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
        'hid-host': path.resolve(__dirname, 'index-hid-host.html'),
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
