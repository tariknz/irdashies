import { app, BrowserWindow } from 'electron';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import path from 'node:path';
import { trackWindowMovement } from './trackWindowMovement';
import { Notification } from 'electron';
import { readData, writeData } from './storage/storage';

// used for Hot Module Replacement
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const APP_GIT_HASH: string;

interface DashboardWidgetWithWindow {
  widget: DashboardWidget;
  window: BrowserWindow;
}

export class OverlayManager {
  private overlayWindows: Record<string, DashboardWidgetWithWindow> = {};
  private currentSettingsWindow: BrowserWindow | undefined;
  private isLocked = true;

  constructor() {
    setInterval(() => {
      this.getOverlays().forEach(({ window }) => {
        if (window.isDestroyed()) return;
        if (!window.isVisible()) return;
        window.setAlwaysOnTop(true, 'screen-saver', 1);
      });
    }, 5000);
  }

  public getVersion(): string {
    const version = app.getVersion();
    const gitHash = typeof APP_GIT_HASH !== 'undefined' ? APP_GIT_HASH : 'dev';
    return `${version}+${gitHash}`;
  }

  public getOverlays(): { widget: DashboardWidget; window: BrowserWindow }[] {
    return Object.values(this.overlayWindows);
  }

  public createOverlays(dashboardLayout: DashboardLayout): void {
    const { widgets } = dashboardLayout;
    widgets.forEach((widget) => {
      if (!widget.enabled) return; // skip disabled widgets
      const window = this.createOverlayWindow(widget);
      trackWindowMovement(widget, window);
    });
    this.createSettingsWindow();
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
      focusable: true, //for OpenKneeeboard/VR
      resizable: false,
      movable: false,
      roundedCorners: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    browserWindow.on('page-title-updated', (evt) => {
      evt.preventDefault();
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
      // notifies the overlay windows that there's a dashboard settings/layout update
      window.webContents.send(key, value);
    });
    this.currentSettingsWindow?.webContents.send(key, value);
  }

  public closeAllOverlays(): void {
    this.getOverlays().forEach(({ window }) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.overlayWindows = {};
  }

  public closeOrCreateWindows(dashboardLayout: DashboardLayout): void {
    const { widgets } = dashboardLayout;
    const widgetsById = widgets.reduce(
      (acc, widget) => {
        acc[widget.id] = widget;
        return acc;
      },
      {} as Record<string, DashboardWidget>
    );

    const openWidgets = this.getOverlays();
    openWidgets.forEach(({ widget, window }) => {
      if (!widgetsById[widget.id]?.enabled) {
        window.close();
        this.overlayWindows = Object.fromEntries(
          Object.entries(this.overlayWindows).filter(([key]) => key !== widget.id)
        );
      }
    });

    widgets.forEach((widget) => {
      if (!widget.enabled) return; // skip disabled widgets
      if (!this.overlayWindows[widget.id]) {
        this.createOverlayWindow(widget);
      }
    });
  }

  public forceRefreshOverlays(dashboardLayout: DashboardLayout): void {
    this.closeAllOverlays();
    const { widgets } = dashboardLayout;
    widgets.forEach((widget) => {
      if (!widget.enabled) return;
      const window = this.createOverlayWindow(widget);
      trackWindowMovement(widget, window);
    });
  }

  public focusSettingsWindow(): void {
    if (this.currentSettingsWindow && !this.currentSettingsWindow.isDestroyed()) {
      if (this.currentSettingsWindow.isMinimized()) {
        this.currentSettingsWindow.restore();
      }
      this.currentSettingsWindow.show();
      this.currentSettingsWindow.focus();
    }
  }

  /**
   * Setup a single instance lock for the application. If the application is already running, it will quit the new instance.
   */
  public setupSingleInstanceLock(): void {
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      this.focusSettingsWindow();
    });
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
      width: 800,
      height: 700,
      autoHideMenuBar: true,
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
      // Show notification about tray access only once ever
      const trayNotificationShown = readData<boolean>('trayNotificationShown');
      if (!trayNotificationShown) {
        new Notification({
          title: 'iRacing Dashies',
          body: 'Settings window is still accessible via the system tray icon'
        }).show();
        writeData('trayNotificationShown', true);
      }
      this.currentSettingsWindow = undefined;
    });

    return browserWindow;
  }
}
