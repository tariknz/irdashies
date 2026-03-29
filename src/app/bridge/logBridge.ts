import { ipcMain } from 'electron';
import log from '../logger';
import type { LogLevel } from '@irdashies/types';

export const setupLogBridge = () => {
  ipcMain.on('log', (_event, level: LogLevel, ...args: unknown[]) => {
    log[level]('[renderer]', ...args);
  });
};
