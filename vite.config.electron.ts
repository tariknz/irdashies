import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'frontend'), // 👈 same root as browser
  build: {
    outDir: path.resolve(__dirname, 'dist/electron'),
    emptyOutDir: true,
  },
});