import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname), // ✅ root is where index.html lives
  build: {
    outDir: 'dist/browser',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@irdashies/storybook': path.resolve(__dirname, '.storybook'),
      '@irdashies/utils': path.resolve(__dirname, 'src/frontend/utils'),
      '@irdashies/context': path.resolve(__dirname, 'src/frontend/context'),
      '@irdashies/types': path.resolve(__dirname, 'src/types')
    }
  },
  define: {
    'process.env': {},
  },
});