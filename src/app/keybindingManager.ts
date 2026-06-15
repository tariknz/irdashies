import { globalShortcut, desktopCapturer } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';
import { isGamepadBinding } from '@irdashies/types';
import { getKeybindings } from './storage/keybindings';
import { OverlayManager } from './overlayManager';
import logger from './logger';
import type { GamepadHost } from './gamepad/gamepadHost';

export class KeybindingManager {
  private bindings: KeybindingsMap;
  private actionHandlers: Map<KeybindingActionId, () => void>;
  private hideState = false;

  /** Lazily-created WebHID host window manager (see startGamepad). */
  private gamepad?: GamepadHost;
  /** Gamepad token (e.g. "gamepad:btn0") -> action it triggers. */
  private gamepadMap = new Map<string, KeybindingActionId>();
  /** When set, captured gamepad presses are reported here instead of triggering actions (rebinding). */
  private captureCb?: (token: string) => void;

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
    this.buildGamepadMap();
    for (const [actionId, entry] of Object.entries(this.bindings)) {
      const handler = this.actionHandlers.get(actionId as KeybindingActionId);
      if (!handler) continue;

      // Gamepad bindings aren't global keyboard shortcuts; the GamepadHost
      // routes them via buildGamepadMap() above.
      if (isGamepadBinding(entry.accelerator)) continue;

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
      if (isGamepadBinding(entry.accelerator)) continue;
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

  /** Rebuild the gamepad token -> action lookup from the current bindings. */
  private buildGamepadMap(): void {
    this.gamepadMap.clear();
    for (const [actionId, entry] of Object.entries(this.bindings)) {
      if (isGamepadBinding(entry.accelerator)) {
        this.gamepadMap.set(entry.accelerator, actionId as KeybindingActionId);
      }
    }
  }

  /**
   * Route a gamepad button-down (a `gamepad:btn<N>` token from the WebHID host)
   * to capture (rebinding) or to its bound action.
   */
  private handleGamepadButton(token: string): void {
    if (this.captureCb) {
      this.captureCb(token);
      return;
    }
    const actionId = this.gamepadMap.get(token);
    if (actionId) this.triggerAction(actionId);
  }

  /**
   * Start reading game controllers. Lazily creates the hidden WebHID host
   * window so its module stays out of the graph for tests; failures are logged
   * and leave keyboard bindings working.
   */
  public startGamepad(): void {
    if (this.gamepad) {
      this.gamepad.start((token) => this.handleGamepadButton(token));
      return;
    }
    import('./gamepad/gamepadHost')
      .then(({ GamepadHost }) => {
        this.gamepad = new GamepadHost();
        this.gamepad.start((token) => this.handleGamepadButton(token));
      })
      .catch((err) =>
        logger.error(
          '[Gamepad] host unavailable, controller bindings disabled',
          err
        )
      );
  }

  /** Tear down the WebHID host window (call on shutdown). */
  public stopGamepad(): void {
    this.gamepad?.stop();
  }

  /** Enter capture mode: the next pad presses are reported to `cb` for rebinding. */
  public startGamepadCapture(cb: (token: string) => void): void {
    this.captureCb = cb;
  }

  /** Leave capture mode; pad presses resume triggering actions. */
  public stopGamepadCapture(): void {
    this.captureCb = undefined;
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
