import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import tsconfig from './tsconfig.json';

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
  resolve: {
    alias: tsconfigPathAliases,
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
});
