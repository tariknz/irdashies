import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/components',
    lib: {
      entry: path.resolve(__dirname, 'src/app/bridge/componentRenderer.tsx'),
      name: 'ComponentRenderer',
      formats: ['umd'],
      fileName: (format) => `component-renderer.${format}.js`,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    minify: 'terser',
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
      '@irdashies/types': path.resolve(__dirname, './src/types/index.ts'),
      '@irdashies/context': path.resolve(__dirname, './src/frontend/context/index.ts'),
    },
  },
});
