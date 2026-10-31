import { globalShortcut, desktopCapturer } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  KeybindingActionId,
  KeybindingsMap,
  KeybindingRegistrationStatuses,
} from '@irdashies/types';
import { KEYBINDING_MESSAGES } from '@irdashies/types';
import {
  normalizeKeyboardAccelerator,
  isGamepadBinding,
  isWidgetToggleActionId,
  nextProfileIndex,
  widgetIdFromToggleActionId,
} from '@irdashies/shared';
import { getKeybindings } from './storage/keybindings';
import { OverlayManager } from './overlayManager';
import logger from './logger';
import { toggleWidgetHidden } from './widgetVisibility';
import { GamepadManager } from './gamepad/gamepadManager';

export class KeybindingManager {
  private bindings: KeybindingsMap;
  private actionHandlers: Map<KeybindingActionId, () => void>;
  private hideState = false;
  private registrationStatuses: KeybindingRegistrationStatuses = {};

  /** Owns the gamepad token -> action map, capture mode, and WebHID host. */
  private gamepad: GamepadManager;

  constructor(private overlayManager: OverlayManager) {
    this.bindings = getKeybindings();
    this.actionHandlers = new Map();
    this.setupActionHandlers();
    this.gamepad = new GamepadManager((actionId) =>
      this.triggerAction(actionId)
    );
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

    this.actionHandlers.set('prev-profile', () => {
      this.cycleProfile(-1);
    });

    this.actionHandlers.set('next-profile', () => {
      this.cycleProfile(1);
    });

    this.actionHandlers.set('radar-flip-pole-side', () => {
      void this.flipRadarPoleSide();
    });
  }

  // ponytail: dynamic import keeps storage/dashboards out of the constructor's
  // module graph (electron isn't fully mocked in keybinding unit tests).
  private async cycleProfile(direction: 1 | -1): Promise<void> {
    try {
      const { listProfiles, getCurrentProfileId, setCurrentProfile } =
        await import('./storage/dashboards');
      const { getCycleProfiles } = await import('./storage/appSettings');

      const profiles = listProfiles();
      if (profiles.length < 2) return;

      const currentId = getCurrentProfileId();
      const currentIndex = profiles.findIndex((p) => p.id === currentId);
      const cycle = getCycleProfiles();

      const targetIndex = nextProfileIndex(
        currentIndex,
        profiles.length,
        direction,
        cycle
      );
      if (targetIndex === -1) return;

      const target = profiles[targetIndex];
      if (!target || target.id === currentId) return;

      // setCurrentProfile emits dashboardUpdated, which live-updates the
      // existing overlay windows (closeOrCreateWindows + publishMessage). No
      // destroy/recreate — see publishDashboardUpdates in dashboardBridge.
      setCurrentProfile(target.id);
    } catch (error) {
      logger.error('Error switching profile via keybind:', error);
    }
  }

  // Dynamic import for the same reason as cycleProfile: storage stays out of
  // the constructor's module graph.
  private async flipRadarPoleSide(): Promise<void> {
    try {
      const { radarPoleSideOverrides } =
        await import('./storage/radarPoleSideOverrides');
      const flipped = radarPoleSideOverrides.flip();
      if (flipped) {
        logger.info(
          `Radar pole side for track ${flipped.trackId} is now ${flipped.poleLeft ? 'left' : 'right'}`
        );
      }
    } catch (error) {
      logger.error('Error flipping the radar pole side via keybind:', error);
    }
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

  /**
   * Resolve the handler for an action id. Static actions come from the handler
   * map; dynamic `toggle-widget:<id>` actions hide/show that widget instance.
   */
  private resolveHandler(
    actionId: KeybindingActionId
  ): (() => void) | undefined {
    if (isWidgetToggleActionId(actionId)) {
      const widgetId = widgetIdFromToggleActionId(actionId);
      return () => this.toggleWidgetHide(widgetId);
    }
    return this.actionHandlers.get(actionId);
  }

  /** Toggle the session-only hidden state of a single widget and broadcast it. */
  private toggleWidgetHide(widgetId: string): void {
    const hide = toggleWidgetHidden(widgetId);
    this.overlayManager.getOverlays().forEach(({ window }) => {
      window.webContents.send('widget-toggle-hide', widgetId, hide);
    });
  }

  public getBindings(): KeybindingsMap {
    return this.bindings;
  }

  public getRegistrationStatuses(): KeybindingRegistrationStatuses {
    return this.registrationStatuses;
  }

  public registerAll(): void {
    const statuses: KeybindingRegistrationStatuses = {};
    const owners = new Map<string, string>();
    this.gamepad.syncBindings(this.bindings);
    for (const [actionId, entry] of Object.entries(this.bindings)) {
      // Unbound entries (empty accelerator) have nothing to register.
      if (!entry.accelerator) continue;

      const handler = this.resolveHandler(actionId as KeybindingActionId);
      if (!handler) continue;

      // Gamepad bindings aren't global keyboard shortcuts; the GamepadManager
      // routes them via syncBindings() above.
      if (isGamepadBinding(entry.accelerator)) continue;

      const id = actionId as KeybindingActionId;
      const normalized = normalizeKeyboardAccelerator(
        entry.accelerator,
        process.platform === 'darwin'
      );
      const owner = owners.get(normalized);
      if (owner !== undefined) {
        statuses[id] = {
          status: 'duplicate',
          message: `Shortcut already bound to "${owner}" in irDashies. Choose another combination.`,
        };
        continue;
      }
      owners.set(normalized, entry.label);

      try {
        // isRegistered only reports registrations owned by this app.
        const registered =
          globalShortcut.isRegistered(entry.accelerator) ||
          globalShortcut.register(entry.accelerator, handler);
        statuses[id] = registered
          ? { status: 'registered' }
          : { status: 'unavailable', message: KEYBINDING_MESSAGES.unavailable };
        if (!registered) {
          // Normal OS refusal is recoverable; warn/error also reach analytics.
          logger.info(`Shortcut unavailable for action "${actionId}"`);
        }
      } catch (error) {
        if (KeybindingManager.isAcceleratorSyntaxError(error)) {
          statuses[id] = {
            status: 'invalid',
            message: KEYBINDING_MESSAGES.invalid,
          };
          logger.info(`Invalid keyboard shortcut for action "${actionId}"`);
        } else {
          statuses[id] = {
            status: 'error',
            message: KEYBINDING_MESSAGES.error,
          };
          logger.error(
            `Error registering shortcut for action "${actionId}":`,
            error
          );
        }
      }
    }
    this.registrationStatuses = statuses;
  }

  public unregisterAll(): void {
    for (const entry of Object.values(this.bindings)) {
      // Unbound entries (empty accelerator) were never registered.
      if (!entry.accelerator || isGamepadBinding(entry.accelerator)) continue;
      try {
        if (globalShortcut.isRegistered(entry.accelerator)) {
          globalShortcut.unregister(entry.accelerator);
        }
      } catch (err) {
        if (!KeybindingManager.isAcceleratorSyntaxError(err)) {
          logger.error('Error unregistering keyboard shortcut:', err);
        }
      }
    }
  }

  /** Start reading game controllers (see {@link GamepadManager.start}). */
  public startGamepad(): void {
    this.gamepad.start();
  }

  /** Tear down the WebHID host window (call on shutdown). */
  public stopGamepad(): void {
    this.gamepad.stop();
  }

  /** Enter capture mode: the next pad presses are reported to `onCapture` for rebinding. */
  public startGamepadCapture(onCapture: (token: string) => void): void {
    this.gamepad.startCapture(onCapture);
  }

  /** Leave capture mode; pad presses resume triggering actions. */
  public stopGamepadCapture(): void {
    this.gamepad.stopCapture();
  }

  private static isAcceleratorSyntaxError(error: unknown): boolean {
    return (
      error instanceof TypeError && /conversion failure/.test(error.message)
    );
  }

  /** Probe availability without conflating OS refusal with invalid syntax. */
  public static checkAccelerator(
    accelerator: string
  ): 'available' | 'invalid' | 'unavailable' {
    try {
      // Never replace or unregister an existing app-owned callback.
      if (globalShortcut.isRegistered(accelerator)) return 'available';
      const registered = globalShortcut.register(accelerator, () => undefined);
      if (!registered) return 'unavailable';
      globalShortcut.unregister(accelerator);
      return 'available';
    } catch (error) {
      if (this.isAcceleratorSyntaxError(error)) return 'invalid';
      throw error;
    }
  }

  public triggerAction(actionId: KeybindingActionId): void {
    const handler = this.resolveHandler(actionId);
    if (handler) handler();
  }

  public reloadBindings(): KeybindingsMap {
    this.unregisterAll();
    this.bindings = getKeybindings();
    this.registerAll();
    return this.bindings;
  }
}
