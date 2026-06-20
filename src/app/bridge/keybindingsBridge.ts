import { ipcMain, webContents } from 'electron';
import type { KeybindingActionId } from '@irdashies/types';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import {
  isGamepadBinding,
  isValidWidgetToggleActionId,
  parseGamepadToken,
} from '@irdashies/shared';
import {
  getKeybindings,
  updateKeybinding,
  resetKeybinding,
  resetAllKeybindings,
} from '../storage/keybindings';
import { KeybindingManager } from '../keybindingManager';
import { rebuildTaskbarMenu } from '../setupTaskbar';
import logger from '../logger';

/** Throw if `actionId` is not a known static action or a valid widget toggle. */
function assertSupportedAction(actionId: KeybindingActionId): void {
  const isStatic = Object.hasOwn(DEFAULT_KEYBINDINGS, actionId);
  if (!isStatic && !isValidWidgetToggleActionId(actionId)) {
    throw new Error(`"${actionId}" is not a supported keybinding action`);
  }
}

/** Throw if `accelerator` is not a valid binding of its kind. */
function assertValidAccelerator(accelerator: string): void {
  if (isGamepadBinding(accelerator)) {
    if (!parseGamepadToken(accelerator)) {
      throw new Error(`"${accelerator}" is not a valid controller button`);
    }
  } else if (!KeybindingManager.isValidAccelerator(accelerator)) {
    throw new Error(`"${accelerator}" is not a valid keyboard shortcut`);
  }
}

/**
 * Register the IPC handlers backing the keybindings settings UI: read/update/
 * reset bindings and the record-mode lifecycle that captures keyboard or gamepad
 * input for rebinding.
 */
export function setupKeybindingsBridge(
  keybindingManager: KeybindingManager
): void {
  ipcMain.handle('keybindings:get', () => {
    return getKeybindings();
  });

  ipcMain.handle(
    'keybindings:update',
    (
      _,
      actionId: KeybindingActionId,
      accelerator: string,
      meta?: { label: string; description: string }
    ) => {
      try {
        assertSupportedAction(actionId);
        // An empty accelerator means "unbind" — nothing to validate.
        if (accelerator) assertValidAccelerator(accelerator);

        const result = updateKeybinding(actionId, accelerator, meta);
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
    // Free keyboard shortcuts so presses reach the settings window, and route
    // captured pad presses to the renderer instead of triggering actions.
    keybindingManager.unregisterAll();
    keybindingManager.startGamepadCapture((token) => {
      for (const wc of webContents.getAllWebContents()) {
        wc.send('keybindings:gamepadCaptured', token);
      }
    });
  });

  ipcMain.handle('keybindings:stopRecording', () => {
    keybindingManager.stopGamepadCapture();
    keybindingManager.registerAll();
  });
}
