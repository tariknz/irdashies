/**
 * Browser stub for `src/app/logger`.
 *
 * The live preview reuses the app's processors, and those log through the
 * main-process logger. That module is Node/Electron only: it pulls in
 * `electron-log/main` -> `electron` (which reads `__dirname` at import time)
 * and reads `process.env`. Both throw in a browser and take down the whole
 * preview chunk, so the site swaps the module out for this console logger.
 *
 * Wired up in `vite.config.ts` via the `stub-app-logger` plugin.
 */
const write =
  (method: 'log' | 'warn' | 'error') =>
  (...args: unknown[]) =>
    console[method](...args);

const logger = {
  debug: write('log'),
  info: write('log'),
  verbose: write('log'),
  silly: write('log'),
  log: write('log'),
  warn: write('warn'),
  error: write('error'),
};

export default logger;
