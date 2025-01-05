import { BrowserWindow } from 'electron';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import path from 'node:path';
import { trackWindowMovement } from './trackWindowMovement';

// used for Hot Module Replacement
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

type DashboardWidgetWithWindow = {
  widget: DashboardWidget;
  window: BrowserWindow;
};

export class OverlayManager {
  private overlayWindows: Record<string, DashboardWidgetWithWindow> = {};
  private currentSettingsWindow: BrowserWindow | undefined;
  private isLocked = true;

  constructor() {
    setInterval(() => {
      this.getOverlays().forEach(({ window }) => {
        if (window.isDestroyed()) return;
        window.setAlwaysOnTop(true, 'screen-saver', 1);
      });
    }, 5000);
  }

  public getOverlays(): { widget: DashboardWidget; window: BrowserWindow }[] {
    return Object.values(this.overlayWindows);
  }

  public createOverlays(dashboardLayout: DashboardLayout): void {
    const { widgets } = dashboardLayout;
    widgets.forEach((widget) => {
      const window = this.createOverlayWindow(widget);
      trackWindowMovement(widget, window);
    });
  }

  public createOverlayWindow(widget: DashboardWidget): BrowserWindow {
    const { id, layout } = widget;
    const { x, y, width, height } = layout;
    const title = id.charAt(0).toUpperCase() + id.slice(1);

    // Create the browser window.
    const browserWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      title: `iRacing Dashies - ${title}`,
      transparent: true,
      frame: false,
      focusable: false,
      resizable: false,
      movable: false,
      roundedCorners: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    browserWindow.setIgnoreMouseEvents(true);
    browserWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
    browserWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      browserWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${id}`);
    } else {
      browserWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: `/${id}` }
      );
    }

    this.overlayWindows[id] = { widget, window: browserWindow };

    return browserWindow;
  }

  public toggleLockOverlays(): boolean {
    this.isLocked = !this.isLocked;
    this.getOverlays().forEach(({ window }) => {
      window.setResizable(!this.isLocked);
      window.setMovable(!this.isLocked);
      window.setIgnoreMouseEvents(this.isLocked);
      window.blur();
      window.webContents.send('editModeToggled', !this.isLocked);
    });

    return this.isLocked;
  }

  public publishMessage(key: string, value: unknown): void {
    this.getOverlays().forEach(({ window }) => {
      if (window.isDestroyed()) return;
      window.webContents.send(key, value);
    });
    this.currentSettingsWindow?.webContents.send(key, value);
  }

  public createSettingsWindow(): BrowserWindow {
    if (this.currentSettingsWindow) {
      this.currentSettingsWindow.show();
      return this.currentSettingsWindow;
    }

    // Create the browser window.
    const browserWindow = new BrowserWindow({
      title: `iRacing Dashies - Settings`,
      frame: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    this.currentSettingsWindow = browserWindow;

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      browserWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/settings`);
    } else {
      browserWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: `/settings` }
      );
    }

    browserWindow.on('closed', () => {
      this.currentSettingsWindow = undefined;
    });

    return browserWindow;
  }
}
