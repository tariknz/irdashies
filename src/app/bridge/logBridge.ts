import { ipcMain, BrowserWindow } from 'electron';
import { PERF_RENDERER_LOG_PREFIX } from '../../types/performance';
import { isPerfCollectionEnabled } from '../perfCollectionConfig';
import logger from '../logger';

export const setupLogBridge = () => {
  ipcMain.on('log', (event, level: unknown, ...args: unknown[]) => {
    // Attribute existing perf reports at their trusted IPC boundary; preload
    // process.pid can be namespace-local. No additional IPC or hot-path work.
    if (
      level === 'info' &&
      isPerfCollectionEnabled() &&
      typeof args[0] === 'string' &&
      args[0].startsWith(PERF_RENDERER_LOG_PREFIX)
    ) {
      try {
        const sample: unknown = JSON.parse(
          args[0].slice(PERF_RENDERER_LOG_PREFIX.length)
        );
        const osPid = event.sender.getOSProcessId();
        if (
          typeof sample === 'object' &&
          sample !== null &&
          'schemaVersion' in sample &&
          sample.schemaVersion === 1
        ) {
          args[0] =
            PERF_RENDERER_LOG_PREFIX +
            JSON.stringify({
              ...sample,
              osPid: osPid > 0 ? osPid : undefined,
              webContentsId: event.sender.id,
              windowId: BrowserWindow.fromWebContents(event.sender)?.id,
            });
        }
      } catch {
        // Preserve malformed/unavailable diagnostics without inventing identity.
      }
    }
    switch (level) {
      case 'debug':
        logger.debug('[renderer]', ...args);
        break;
      case 'info':
        logger.info('[renderer]', ...args);
        break;
      case 'warn':
        logger.warn('[renderer]', ...args);
        break;
      case 'error':
        logger.error('[renderer]', ...args);
        break;
    }
  });
};
