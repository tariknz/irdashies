import { ipcMain } from 'electron';
import logger from '../logger';
import type { LogLevel } from '@irdashies/types';

export const setupLogBridge = () => {
  ipcMain.on('log', (_event, level: LogLevel, ...args: unknown[]) => {
    logger[level]('[renderer]', ...args);
  });
};
