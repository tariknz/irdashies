import { ipcMain, webContents } from 'electron';
import type {
  KeybindingActionId,
  KeybindingUpdateResult,
} from '@irdashies/types';
import { DEFAULT_KEYBINDINGS, KEYBINDING_MESSAGES } from '@irdashies/types';
import {
  isGamepadBinding,
  isValidWidgetToggleActionId,
  parseGamepadTokens,
} from '@irdashies/shared';
import {
  getKeybindings,
  findKeybindingConflict,
  KeybindingConflictError,
  updateKeybinding,
  resetKeybinding,
  resetAllKeybindings,
  persistKeybindingMigrations,
} from '../storage/keybindings';
import { KeybindingManager } from '../keybindingManager';
import { rebuildTaskbarMenu } from '../setupTaskbar';
import logger from '../logger';

/** Throw if `actionId` is not a known static action or a valid widget toggle. */
function assertSupportedAction(actionId: unknown): void {
  if (typeof actionId !== 'string')
    throw new Error('Invalid keybinding action');
  const isStatic = Object.hasOwn(DEFAULT_KEYBINDINGS, actionId);
  if (!isStatic && !isValidWidgetToggleActionId(actionId)) {
    throw new Error(`"${actionId}" is not a supported keybinding action`);
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
  persistKeybindingMigrations().catch((error) =>
    logger.warn('[Keybindings] Could not persist migrated bindings:', error)
  );

  ipcMain.handle('keybindings:registrationStatuses', () =>
    keybindingManager.getRegistrationStatuses()
  );

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
    ): KeybindingUpdateResult => {
      try {
        assertSupportedAction(actionId);
        if (
          typeof accelerator !== 'string' ||
          (meta !== undefined &&
            (!meta ||
              typeof meta.label !== 'string' ||
              typeof meta.description !== 'string'))
        ) {
          throw new Error('Invalid keybinding arguments');
        }
        const conflict = findKeybindingConflict(
          getKeybindings(),
          actionId,
          accelerator
        );
        if (conflict !== undefined) {
          return {
            ok: false,
            message: `Shortcut already bound to "${conflict}" in irDashies. Choose another combination.`,
          };
        }
        if (accelerator) {
          if (isGamepadBinding(accelerator)) {
            if (!parseGamepadTokens(accelerator)) {
              return {
                ok: false,
                message: 'Invalid controller button. Choose another button.',
              };
            }
          } else {
            const result = KeybindingManager.checkAccelerator(accelerator);
            if (result !== 'available')
              return { ok: false, message: KEYBINDING_MESSAGES[result] };
          }
        }

        const result = updateKeybinding(actionId, accelerator, meta);
        keybindingManager.reloadBindings();
        rebuildTaskbarMenu();

        return { ok: true, bindings: result };
      } catch (err) {
        if (err instanceof KeybindingConflictError)
          return { ok: false, message: err.message };
        logger.error('Failed to update keybinding:', err);
        throw err;
      }
    }
  );

  ipcMain.handle('keybindings:reset', (_, actionId: KeybindingActionId) => {
    assertSupportedAction(actionId);
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
