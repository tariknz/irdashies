import { ipcMain } from 'electron';
import type { ChromiumFlagsType } from '@irdashies/types';
import { getChromiumFlags, saveChromiumFlags } from '../storage/chromiumFlags';

export function setupChromiumFlagsBridge(): void {
  ipcMain.handle('chromiumFlags:get', () => {
    return getChromiumFlags();
  });

  ipcMain.handle('chromiumFlags:save', (_, flags: ChromiumFlagsType) => {
    return saveChromiumFlags(flags);
  });
}
