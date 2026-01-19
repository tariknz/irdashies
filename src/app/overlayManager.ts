import { app, BrowserWindow } from 'electron';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import path from 'node:path';
import { trackWindowMovement } from './trackWindowMovement';
import { Notification } from 'electron';
import { readData, writeData } from './storage/storage';
import { getDashboard } from './storage/dashboards';

// used for Hot Module Replacement
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const APP_GIT_HASH: string;

interface DashboardWidgetWithWindow {
  widget: DashboardWidget;
  window: BrowserWindow;
}

function getIconPath(): string {
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const basePath = isDev 
    ? path.join(__dirname, '../../docs/assets/icons')
    : path.join(process.resourcesPath, 'icons');
  
  return path.join(basePath, 'logo.png');
}

export class OverlayManager {
  private overlayWindows = new Map<string, DashboardWidgetWithWindow>();
  private currentSettingsWindow: BrowserWindow | undefined;
  private isLocked = true;
  private skipTaskbar = true;
  private overlayAlwaysOnTop = true;
  private hasSingleInstanceLock = false;

  constructor() {
    setInterval(() => {
      this.getOverlays().forEach(({ window }) => {
        if (window.isDestroyed()) return;
        if (!window.isVisible()) return;
        if (this.overlayAlwaysOnTop) {
          window.setAlwaysOnTop(true, 'screen-saver', 1);
        } else {
          window.setAlwaysOnTop(false);
        }
      });
    }, 5000);
  }

  public getVersion(): string {
    const version = app.getVersion();
    const gitHash = typeof APP_GIT_HASH !== 'undefined' ? APP_GIT_HASH : 'dev';
    return `${version}+${gitHash}`;
  }

  public getOverlays(): { widget: DashboardWidget; window: BrowserWindow }[] {
    return Array.from(this.overlayWindows.values());
  }

  public createOverlays(dashboardLayout: DashboardLayout): void {
    const { widgets, generalSettings } = dashboardLayout;
    this.skipTaskbar = generalSettings?.skipTaskbar ?? true;
    this.overlayAlwaysOnTop = generalSettings?.overlayAlwaysOnTop ?? true;
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
      skipTaskbar: this.skipTaskbar,
      focusable: true, //for OpenKneeeboard/VR
      resizable: false,
      movable: false,
      roundedCorners: false,
      icon: getIconPath(),
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
    if (this.overlayAlwaysOnTop) {
      browserWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      browserWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${id}`);
    } else {
      browserWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: `/${id}` }
      );
    }

    this.overlayWindows.set(id, { widget, window: browserWindow });

    browserWindow.on('closed', () => {
      const closedWindow = this.overlayWindows.get(id);
      if (closedWindow) {
        console.log('Closing window', closedWindow.widget.id);
      }
      this.overlayWindows.delete(id);
    });

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
      try {
        window.webContents.send(key, value);
      } catch (e) {
        console.error(`Failed to send message ${key} to window`, e);
      }
    });
    if (this.currentSettingsWindow && !this.currentSettingsWindow.isDestroyed()) {
      try {
        this.currentSettingsWindow.webContents.send(key, value);
      } catch (e) {
        console.error(`Failed to send message ${key} to settings window`, e);
      }
    }
  }

  public closeAllOverlays(): void {
    this.getOverlays().forEach(({ window }) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.overlayWindows.clear();
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
      // const dashboardWidget = widgetsById[widget.id];
      if (!widgetsById[widget.id]?.enabled) {
        window.close();
        this.overlayWindows.delete(widget.id);
      }
    });

    widgets.forEach((widget) => {
      if (!widget.enabled) {
        return;
      }
      if (!this.overlayWindows.has(widget.id)) {
        const window = this.createOverlayWindow(widget);
        trackWindowMovement(widget, window);
      } else {
        // Window already exists
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
   * Check dashboard settings and disable hardware acceleration if configured.
   * Must be called before the app is ready.
   */
  public setupHardwareAcceleration(): void {
    const dashboard = getDashboard('default');
    if (dashboard?.generalSettings?.disableHardwareAcceleration) {
      app.disableHardwareAcceleration();
    }
  }

  public setupAutoStart(): void {
    const dashboard = getDashboard('default');
    app.setLoginItemSettings({
      openAtLogin: dashboard?.generalSettings?.enableAutoStart ?? false,
    });
  }

  /**
   * Setup a single instance lock for the application. If the application is already running, it will quit the new instance.
   * @returns true if the lock was obtained, false otherwise
   */
  public setupSingleInstanceLock(): boolean {
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
      this.hasSingleInstanceLock = false;
      return false;
    }

    this.hasSingleInstanceLock = true;
    app.on('second-instance', () => {
      this.focusSettingsWindow();
    });
    return true;
  }

  /**
   * Check if the application has obtained the single instance lock.
   * This should be checked before starting services that require exclusive access (like servers).
   */
  public hasLock(): boolean {
    return this.hasSingleInstanceLock;
  }

  public createSettingsWindow(): BrowserWindow {
    if (this.currentSettingsWindow) {
      this.currentSettingsWindow.show();
      return this.currentSettingsWindow;
    }

    // Load saved window bounds
    const savedBounds = loadWindowBounds();
    const defaultOptions = {
      title: `iRacing Dashies - Settings`,
      frame: true,
      width: 800,
      height: 700,
      autoHideMenuBar: true,
      icon: getIconPath(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    };

    // Create the browser window with saved bounds if available
    const browserWindow = new BrowserWindow(
      savedBounds ? { ...defaultOptions, ...savedBounds } : defaultOptions
    );

    this.currentSettingsWindow = browserWindow;

    // Track window movement and resizing to save bounds
    trackSettingsWindowMovement(browserWindow);

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

function saveWindowBounds(browserWindow: BrowserWindow): void {
  const bounds = browserWindow.getBounds();
  writeData('settingsWindowBounds', bounds);
}

function loadWindowBounds(): Electron.Rectangle | undefined {
  return readData<Electron.Rectangle>('settingsWindowBounds');
}

export const trackSettingsWindowMovement = (
  browserWindow: BrowserWindow
) => {
  // Tracks moved and resized events on settings window and saves bounds to storage
  browserWindow.on('moved', () => saveWindowBounds(browserWindow));
  browserWindow.on('resized', () => saveWindowBounds(browserWindow));
};
