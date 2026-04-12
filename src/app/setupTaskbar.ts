import { nativeImage, Tray, Menu } from 'electron';
import { OverlayManager } from './overlayManager';
import { KeybindingManager } from './keybindingManager';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;

const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

function getIconPath(): string {
  const basePath = isDev
    ? path.join(__dirname, '../../docs/assets/icons')
    : path.join(process.resourcesPath, 'icons');

  return path.join(basePath, 'logo-tray.png');
}

class Taskbar {
  private tray: Tray;

  constructor(
    private overlayManager: OverlayManager,
    private keybindingManager: KeybindingManager
  ) {
    this.tray = this.createTray();
    this.buildContextMenu();
  }

  private createTray(): Tray {
    const iconPath = getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    const tray = new Tray(icon);
    tray.setToolTip('irDashies');

    tray.on('click', () => {
      this.overlayManager.focusSettingsWindow();
    });

    return tray;
  }

  public buildContextMenu(): void {
    const bindings = this.keybindingManager.getBindings();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Settings',
        click: () => {
          this.overlayManager.focusSettingsWindow();
        },
      },
      {
        label: `Lock / Unlock (${bindings['toggle-edit-mode'].accelerator})`,
        click: () => {
          this.overlayManager.toggleLockOverlays();
        },
      },
      {
        label: `Save Current Telemetry (${bindings['save-telemetry'].accelerator})`,
        click: () => {
          this.keybindingManager.triggerAction('save-telemetry');
        },
      },
      {
        label: 'Quit',
        click: () => {
          this.overlayManager.quitApp();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }
}

let taskbarInstance: Taskbar | undefined;

export const setupTaskbar = (
  overlayManager: OverlayManager,
  keybindingManager: KeybindingManager
) => {
  taskbarInstance = new Taskbar(overlayManager, keybindingManager);
};

export const rebuildTaskbarMenu = () => {
  taskbarInstance?.buildContextMenu();
};
