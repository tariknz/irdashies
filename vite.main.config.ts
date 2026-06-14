import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

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
    nativeModules(
      [
        {
          file: 'build/Release/irsdk_node.node',
          exportName: 'iRacingSdkNode',
          accessor: 'iRacingSdkNode',
        },
        { file: 'build/Release/vr_overlay.node', exportName: 'vrOverlay' },
      ],
      '.vite/build/Release/'
    ),
  ],
  build: {
    rollupOptions: {
      // @kmamal/sdl is a prebuilt native module; load it from node_modules at
      // runtime instead of bundling it.
      external: ['bufferutil', 'utf-8-validate', '@kmamal/sdl'],
    },
  },
  resolve: {
    // Some dependencies have Node.js specific imports
    // This ensures they are properly resolved in Electron
    mainFields: ['module', 'jsnext:main', 'jsnext'],
    tsconfigPaths: true,
  },
  define: {
    APP_GIT_HASH: JSON.stringify(getGitHash()),
    POSTHOG_KEY: JSON.stringify(process.env.POSTHOG_KEY || ''),
  },
});

// Handles native .node modules so vite can bundle them (they are cjs only).
// For each entry the plugin rewrites the import using createRequire and copies
// the .node into the vite build directory. `accessor` picks a property off the
// required module (e.g. a class export); omit it to re-export the whole module.
interface NativeModuleEntry {
  file: string;
  exportName: string;
  accessor?: string;
}

function nativeModules(entries: NativeModuleEntry[], outDir: string) {
  const entryMap = new Map(
    entries.map((entry) => [path.basename(entry.file), entry])
  );

  return {
    name: 'native-module-plugin',
    resolveId(source: string) {
      return entryMap.has(path.basename(source)) ? source : null;
    },
    transform(code: string, id: string) {
      // check platform
      if (process.platform !== 'win32') {
        return code;
      }
      const entry = entryMap.get(path.basename(id));
      if (entry) {
        const access = entry.accessor ? `.${entry.accessor}` : '';
        return {
          code: `
            import { createRequire } from 'module';
            const customRequire = createRequire(__filename);
            export const ${entry.exportName} = customRequire('./Release/${path.basename(entry.file)}')${access};
          `,
          moduleType: 'js',
        };
      }
      return code;
    },
    load(id: string) {
      return entryMap.has(path.basename(id)) ? '' : null;
    },
    generateBundle() {
      // check platform
      if (process.platform !== 'win32') {
        return;
      }
      entryMap.forEach((entry, file) => {
        const out = `${outDir}/${file}`;
        if (!fs.existsSync(entry.file)) {
          console.warn(
            `[nativeModules] Native module not found at: ${entry.file}`
          );
          return;
        }
        const nodeFile = fs.readFileSync(entry.file);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, nodeFile);
      });
    },
  };
}
