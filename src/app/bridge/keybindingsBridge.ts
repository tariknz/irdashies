import { ipcMain } from 'electron';
import type { KeybindingActionId } from '@irdashies/types';
import {
  getKeybindings,
  updateKeybinding,
  resetKeybinding,
  resetAllKeybindings,
} from '../storage/keybindings';
import { KeybindingManager } from '../keybindingManager';
import { rebuildTaskbarMenu } from '../setupTaskbar';
import logger from '../logger';

export function setupKeybindingsBridge(
  keybindingManager: KeybindingManager
): void {
  ipcMain.handle('keybindings:get', () => {
    return getKeybindings();
  });

  ipcMain.handle(
    'keybindings:update',
    (_, actionId: KeybindingActionId, accelerator: string) => {
      try {
        const result = updateKeybinding(actionId, accelerator);
        keybindingManager.reloadBindings();
        rebuildTaskbarMenu();
        return result;
      } catch (err) {
        logger.error('Failed to update keybinding:', err);
        throw err;
      }
    }
  );

  ipcMain.handle('keybindings:reset', (_, actionId: KeybindingActionId) => {
    const result = resetKeybinding(actionId);
    keybindingManager.reloadBindings();
    rebuildTaskbarMenu();
    return result;
  });

  ipcMain.handle('keybindings:resetAll', () => {
    const result = resetAllKeybindings();
    keybindingManager.reloadBindings();
    rebuildTaskbarMenu();
    return result;
  });

  ipcMain.handle('keybindings:startRecording', () => {
    keybindingManager.unregisterAll();
  });

  ipcMain.handle('keybindings:stopRecording', () => {
    keybindingManager.registerAll();
  });
}
