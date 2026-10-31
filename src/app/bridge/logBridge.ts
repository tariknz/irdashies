import { ipcMain } from 'electron';
import logger from '../logger';

export const setupLogBridge = () => {
  ipcMain.on('log', (_event, level: unknown, ...args: unknown[]) => {
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
