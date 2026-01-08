import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get git hash
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (ex) {
    console.warn('Error getting git hash', ex);
    return 'unknown';
  }
};

export default defineConfig({
  plugins: [
    irsdkNativeModule(
      ['build/Release/irsdk_node.node'],
      '.vite/build/Release/'
    ),
  ],
  build: {
    rollupOptions: {
      external: ['bufferutil', 'utf-8-validate'],
    },
  },
  resolve: {
    // Some dependencies have Node.js specific imports
    // This ensures they are properly resolved in Electron
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  define: {
    APP_GIT_HASH: JSON.stringify(getGitHash()),
    POSTHOG_KEY: JSON.stringify(process.env.POSTHOG_KEY || ''),
  },
});

// this handles the native module for irsdk-node so vite can bundle it as its currently cjs only
// this plugin will import it using createRequire and copy the native module to the vite build directory
function irsdkNativeModule(nodeFiles: string[], outDir: string) {
  const nodeFileMap = new Map(
    nodeFiles.map((file) => [path.basename(file), file])
  );

  return {
    name: 'irsdk-native-module-plugin',
    resolveId(source: string) {
      return nodeFileMap.has(path.basename(source)) ? source : null;
    },
    transform(code: string, id: string) {
      // check platform
      if (process.platform !== 'win32') {
        return code;
      }
      const file = nodeFileMap.get(path.basename(id));
      if (file) {
        return `
          import { createRequire } from 'module';
          const customRequire = createRequire(import.meta.url);
          export const iRacingSdkNode = customRequire('./${file}').iRacingSdkNode;
        `;
      }
      return code;
    },
    load(id: string) {
      return nodeFileMap.has(path.basename(id)) ? '' : null;
    },
    generateBundle() {
      // check platform
      if (process.platform !== 'win32') {
        return;
      }
      nodeFileMap.forEach((fileAbs, file) => {
        const out = `${outDir}/${file}`;
        const nodeFile = fs.readFileSync(fileAbs);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, nodeFile);
      });
    },
  };
}
