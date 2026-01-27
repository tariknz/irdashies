import { app, BrowserWindow, screen } from 'electron';
import type { DashboardLayout } from '@irdashies/types';
import path from 'node:path';
import { Notification } from 'electron';
import { readData, writeData } from './storage/storage';
import { getDashboard } from './storage/dashboards';
import { trackSettingsWindowMovement } from './trackWindowMovement';

// used for Hot Module Replacement
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const APP_GIT_HASH: string;

function getIconPath(): string {
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const basePath = isDev
    ? path.join(__dirname, '../../docs/assets/icons')
    : path.join(process.resourcesPath, 'icons');

  return path.join(basePath, 'logo.png');
}

export class OverlayManager {
  private containerWindow: BrowserWindow | undefined;
  private currentSettingsWindow: BrowserWindow | undefined;
  private isLocked = true;
  private skipTaskbar = true;
  private overlayAlwaysOnTop = true;
  private hasSingleInstanceLock = false;
  private onWindowReadyCallbacks = new Set<(windowId: string) => void>();

  public getVersion(): string {
    const version = app.getVersion();
    const gitHash = typeof APP_GIT_HASH !== 'undefined' ? APP_GIT_HASH : 'dev';
    return `${version}+${gitHash}`;
  }

  /**
   * Get the container window (for backwards compatibility with IPC)
   */
  public getOverlays(): { window: BrowserWindow }[] {
    if (this.containerWindow && !this.containerWindow.isDestroyed()) {
      return [{ window: this.containerWindow }];
    }
    return [];
  }

  /**
   * Create the single overlay container window that holds all widgets
   */
  public createOverlays(dashboardLayout: DashboardLayout): void {
    const { generalSettings } = dashboardLayout;
    this.skipTaskbar = generalSettings?.skipTaskbar ?? true;
    this.overlayAlwaysOnTop = generalSettings?.overlayAlwaysOnTop ?? true;

    this.createContainerWindow();
    this.createSettingsWindow();
  }

  /**
   * Create a single fullscreen transparent window that contains all overlays
   */
  private createContainerWindow(): BrowserWindow {
    if (this.containerWindow && !this.containerWindow.isDestroyed()) {
      return this.containerWindow;
    }

    // Get display bounds - use primary display for now
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;

    const browserWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      title: 'iRacing Dashies - Overlay Container',
      transparent: true,
      frame: false,
      skipTaskbar: this.skipTaskbar,
      focusable: true, // for OpenKneeboard/VR
      resizable: false,
      movable: false,
      roundedCorners: false,
      hasShadow: false,
      icon: getIconPath(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    browserWindow.on('page-title-updated', (evt) => {
      evt.preventDefault();
    });

    // Enable click-through with event forwarding for edit mode
    browserWindow.setIgnoreMouseEvents(true, { forward: true });
    browserWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });

    if (this.overlayAlwaysOnTop) {
      // Use 'floating' level to stay above normal windows but below modal dialogs
      // 'screen-saver' was too aggressive and interfered with settings window clicks
      browserWindow.setAlwaysOnTop(true, 'floating', 1);
    }

    // Load the app WITHOUT a hash route - container mode
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      browserWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      browserWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    this.containerWindow = browserWindow;

    browserWindow.on('closed', () => {
      console.log('Container window closed');
      this.containerWindow = undefined;
    });

    browserWindow.webContents.once('did-finish-load', () => {
      if (!browserWindow.isDestroyed()) {
        // Notify that the container is ready
        this.onWindowReadyCallbacks.forEach((cb) => cb('container'));
      }
    });

    return browserWindow;
  }

  /**
   * Toggle edit mode - enables/disables mouse interaction with overlays
   */
  public toggleLockOverlays(): boolean {
    this.isLocked = !this.isLocked;

    if (this.containerWindow && !this.containerWindow.isDestroyed()) {
      // In edit mode, allow mouse events; in locked mode, pass through
      this.containerWindow.setIgnoreMouseEvents(this.isLocked, {
        forward: true,
      });
      this.containerWindow.webContents.send('editModeToggled', !this.isLocked);

      if (!this.isLocked) {
        // In edit mode, bring to focus for interaction
        this.containerWindow.focus();
      }
    }

    return this.isLocked;
  }

  /**
   * Send a message to the container window and settings window
   */
  public publishMessage(key: string, value: unknown): void {
    // Send to container window
    if (this.containerWindow && !this.containerWindow.isDestroyed()) {
      try {
        this.containerWindow.webContents.send(key, value);
      } catch (e) {
        console.error(`Failed to send message ${key} to container window`, e);
      }
    }

    // Send to settings window
    if (
      this.currentSettingsWindow &&
      !this.currentSettingsWindow.isDestroyed()
    ) {
      try {
        this.currentSettingsWindow.webContents.send(key, value);
      } catch (e) {
        console.error(`Failed to send message ${key} to settings window`, e);
      }
    }
  }

  /**
   * Send a message to a specific overlay (for backwards compatibility)
   * In container mode, this just sends to the container
   */
  public publishMessageToOverlay(
    _id: string,
    key: string,
    value: unknown
  ): void {
    this.publishMessage(key, value);
  }

  public onOverlayReady(callback: (id: string) => void) {
    this.onWindowReadyCallbacks.add(callback);
    return () => this.onWindowReadyCallbacks.delete(callback);
  }

  /**
   * Close the container window
   */
  public closeAllOverlays(): void {
    if (this.containerWindow && !this.containerWindow.isDestroyed()) {
      this.containerWindow.close();
    }
    this.containerWindow = undefined;
  }

  /**
   * In container mode, we don't need to close/create windows for widget changes
   * The container handles widget visibility internally via React state
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public closeOrCreateWindows(_dashboardLayout?: DashboardLayout): void {
    // In container mode, widget visibility is handled by the React OverlayContainer
    // We only need to ensure the container window exists
    if (!this.containerWindow || this.containerWindow.isDestroyed()) {
      this.createContainerWindow();
    }
    // The dashboard update is already published via IPC, so React will handle the rest
  }

  /**
   * Force refresh by recreating the container window
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public forceRefreshOverlays(_dashboardLayout?: DashboardLayout): void {
    this.closeAllOverlays();
    this.createContainerWindow();
  }

  public focusSettingsWindow(): void {
    if (
      this.currentSettingsWindow &&
      !this.currentSettingsWindow.isDestroyed()
    ) {
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
          body: 'Settings window is still accessible via the system tray icon',
        }).show();
        writeData('trayNotificationShown', true);
      }
      this.currentSettingsWindow = undefined;
    });

    return browserWindow;
  }
}

function loadWindowBounds(): Electron.Rectangle | undefined {
  return readData<Electron.Rectangle>('settingsWindowBounds');
}
