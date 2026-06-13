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

    this.actionHandlers.set('recenter-vr', () => {
      // Lazy import so the native VR addon is only loaded when actually used
      // (keeps it out of the module graph for tests and non-VR sessions).
      import('./vr/vrOverlay')
        .then((m) => m.recenterVrOverlay())
        .catch((err) => logger.error('[VR] recenter failed', err));
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

      try {
        // Skip if already registered (idempotent — safe to call after reloadBindings)
        if (globalShortcut.isRegistered(entry.accelerator)) continue;

        const registered = globalShortcut.register(entry.accelerator, handler);
        if (!registered) {
          logger.error(
            `Failed to register shortcut "${entry.accelerator}" for action "${actionId}"`
          );
        }
      } catch (err) {
        // Electron throws a TypeError when the accelerator string is not parseable
        // (e.g. unsupported keys like "Pause"). Skip the bad binding so the rest still register.
        logger.error(
          `Invalid accelerator "${entry.accelerator}" for action "${actionId}", skipping:`,
          err
        );
      }
    }
  }

  public unregisterAll(): void {
    for (const entry of Object.values(this.bindings)) {
      try {
        if (globalShortcut.isRegistered(entry.accelerator)) {
          globalShortcut.unregister(entry.accelerator);
        }
      } catch (err) {
        logger.error(
          `Invalid accelerator "${entry.accelerator}" while unregistering, skipping:`,
          err
        );
      }
    }
  }

  /**
   * Verifies an accelerator string is parseable by Electron by attempting a
   * trial registration. Returns true if valid (and leaves no registration behind).
   */
  public static isValidAccelerator(accelerator: string): boolean {
    try {
      const noop = () => undefined;
      const registered = globalShortcut.register(accelerator, noop);
      if (registered) {
        globalShortcut.unregister(accelerator);
      }
      return registered;
    } catch {
      return false;
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
