import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
  plugins: [
    {
      name: 'drop-inline-dynamic-imports',
      config(config) {
        const output =
          config.build?.rolldownOptions?.output ??
          config.build?.rollupOptions?.output;
        if (output && !Array.isArray(output)) {
          delete output.inlineDynamicImports;
          output.codeSplitting = false;
        }
      },
    },
  ],
});
