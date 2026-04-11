import { globalShortcut, desktopCapturer } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';
import { getKeybindings } from './storage/keybindings';
import { OverlayManager } from './overlayManager';
import logger from './logger';

export class KeybindingManager {
  private bindings: KeybindingsMap;
  private actionHandlers: Map<KeybindingActionId, () => void>;
  private hideState = false;

  constructor(private overlayManager: OverlayManager) {
    this.bindings = getKeybindings();
    this.actionHandlers = new Map();
    this.setupActionHandlers();
  }

  private setupActionHandlers(): void {
    this.actionHandlers.set('toggle-hide-ui', () => {
      this.hideState = !this.hideState;
      this.overlayManager.getOverlays().forEach(({ window }) => {
        window.webContents.send('global-toggle-hide', this.hideState);
      });
    });

    this.actionHandlers.set('toggle-edit-mode', () => {
      this.overlayManager.toggleLockOverlays();
    });

    this.actionHandlers.set('save-telemetry', () => {
      this.saveTelemetry();
    });
  }

  private async saveTelemetry(): Promise<void> {
    try {
      const { dumpCurrentTelemetry } =
        await import('./bridge/iracingSdk/dumpTelemetry');
      const telemetryResult = await dumpCurrentTelemetry();

      const dirPath =
        telemetryResult && 'dirPath' in telemetryResult
          ? telemetryResult.dirPath
          : null;
      if (dirPath) {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 },
        });

        await Promise.all(
          sources.map(async (source, index) => {
            if (source.thumbnail) {
              const screenshotPath = path.join(
                dirPath,
                `screenshot_${index + 1}.png`
              );
              const pngData = source.thumbnail.toPNG();
              await writeFile(screenshotPath, pngData);
              logger.info(
                `Screenshot ${index + 1} saved to: ${screenshotPath}`
              );
            }
          })
        );
      }
    } catch (error) {
      logger.error('Error capturing screenshots:', error);
    }
  }

  public getBindings(): KeybindingsMap {
    return this.bindings;
  }

  public registerAll(): void {
    for (const [actionId, entry] of Object.entries(this.bindings)) {
      const handler = this.actionHandlers.get(actionId as KeybindingActionId);
      if (!handler) continue;

      // Skip if already registered (idempotent — safe to call after reloadBindings)
      if (globalShortcut.isRegistered(entry.accelerator)) continue;

      const registered = globalShortcut.register(entry.accelerator, handler);
      if (!registered) {
        logger.error(
          `Failed to register shortcut "${entry.accelerator}" for action "${actionId}"`
        );
      }
    }
  }

  public unregisterAll(): void {
    for (const entry of Object.values(this.bindings)) {
      if (globalShortcut.isRegistered(entry.accelerator)) {
        globalShortcut.unregister(entry.accelerator);
      }
    }
  }

  public triggerAction(actionId: KeybindingActionId): void {
    const handler = this.actionHandlers.get(actionId);
    if (handler) handler();
  }

  public reloadBindings(): KeybindingsMap {
    this.unregisterAll();
    this.bindings = getKeybindings();
    this.registerAll();
    return this.bindings;
  }
}
