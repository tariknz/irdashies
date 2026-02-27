import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  screen,
} from 'electron';
import type { DashboardLayout, ContainerBoundsInfo } from '@irdashies/types';
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
  private displayWindows = new Map<number, BrowserWindow>();
  private displayBoundsInfo = new Map<number, ContainerBoundsInfo>();
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
   * Get all display overlay windows
   */
  public getOverlays(): { window: BrowserWindow }[] {
    const result: { window: BrowserWindow }[] = [];
    for (const win of this.displayWindows.values()) {
      if (!win.isDestroyed()) {
        result.push({ window: win });
      }
    }
    return result;
  }

  /**
   * Create one overlay window per display
   */
  public createOverlays(dashboardLayout: DashboardLayout): void {
    const { generalSettings } = dashboardLayout;
    this.skipTaskbar = generalSettings?.skipTaskbar ?? true;
    this.overlayAlwaysOnTop = generalSettings?.overlayAlwaysOnTop ?? true;

    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    console.log(`[OverlayManager] Found ${allDisplays.length} display(s):`);
    for (const display of allDisplays) {
      const isPrimary = display.id === primaryDisplay.id;
      console.log(
        `  Display ${display.id}${isPrimary ? ' (PRIMARY)' : ''}: bounds=${JSON.stringify(display.bounds)}`
      );
    }

    // Determine which displays have widgets assigned (by center-point)
    const displaysWithWidgets = new Set<number>();
    for (const widget of dashboardLayout.widgets) {
      if (!widget.enabled) continue;
      const centerX = widget.layout.x + widget.layout.width / 2;
      const centerY = widget.layout.y + widget.layout.height / 2;
      for (const display of allDisplays) {
        const { x, y, width, height } = display.bounds;
        if (
          centerX >= x &&
          centerX < x + width &&
          centerY >= y &&
          centerY < y + height
        ) {
          displaysWithWidgets.add(display.id);
          break;
        }
      }
    }

    // Always create a window for the primary display (fallback for unmatched widgets)
    displaysWithWidgets.add(primaryDisplay.id);

    for (const display of allDisplays) {
      if (!displaysWithWidgets.has(display.id)) {
        console.log(
          `[OverlayManager] Skipping display ${display.id} — no widgets assigned`
        );
        continue;
      }
      const isPrimary = display.id === primaryDisplay.id;
      this.createWindowForDisplay(display, isPrimary);
    }

    this.createSettingsWindow();
  }

  /**
   * Create a transparent overlay window sized exactly to one display
   */
  private createWindowForDisplay(
    display: Electron.Display,
    isPrimary: boolean
  ): BrowserWindow {
    const existing = this.displayWindows.get(display.id);
    if (existing && !existing.isDestroyed()) {
      return existing;
    }

    const expectedBounds = {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
    };

    console.log(
      `[OverlayManager] Creating window for display ${display.id}${isPrimary ? ' (PRIMARY)' : ''}: x=${expectedBounds.x}, y=${expectedBounds.y}, ${expectedBounds.width}x${expectedBounds.height}`
    );

    const browserWindow = new BrowserWindow({
      x: expectedBounds.x,
      y: expectedBounds.y,
      width: expectedBounds.width,
      height: expectedBounds.height,
      title: `irDashies - Display ${display.id} (${isPrimary ? 'Main' : ''})`,
      transparent: true,
      frame: false,
      skipTaskbar: this.skipTaskbar,
      focusable: true, // for OpenKneeboard/VR
      resizable: false,
      movable: false,
      roundedCorners: false,
      hasShadow: false,
      show: false,
      alwaysOnTop: true,
      backgroundColor: '#00000000',
      icon: getIconPath(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling: false,
      },
    });

    browserWindow.setBounds(expectedBounds);

    browserWindow.on('page-title-updated', (evt) => {
      evt.preventDefault();
    });

    browserWindow.setIgnoreMouseEvents(this.isLocked);
    browserWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });

    if (this.overlayAlwaysOnTop) {
      browserWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      browserWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      browserWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    this.displayWindows.set(display.id, browserWindow);

    browserWindow.on('closed', () => {
      console.log(`Display ${display.id} overlay window closed`);
      this.displayWindows.delete(display.id);
      this.displayBoundsInfo.delete(display.id);
    });

    // Track readiness of both events to avoid race condition
    let boundsReady = false;
    let pageLoaded = false;

    const sendBoundsIfReady = () => {
      if (!boundsReady || !pageLoaded) return;
      if (browserWindow.isDestroyed()) return;

      const boundsInfo = this.displayBoundsInfo.get(display.id);
      browserWindow.webContents.send('containerBoundsInfo', boundsInfo);
      this.onWindowReadyCallbacks.forEach((cb) => cb(`display-${display.id}`));
    };

    browserWindow.once('ready-to-show', () => {
      if (browserWindow.isDestroyed()) return;

      browserWindow.setPosition(expectedBounds.x, expectedBounds.y);
      browserWindow.setSize(expectedBounds.width, expectedBounds.height);
      browserWindow.show();

      const actualBounds = browserWindow.getBounds();
      const offset = {
        x: actualBounds.x - expectedBounds.x,
        y: actualBounds.y - expectedBounds.y,
      };

      const boundsInfo: ContainerBoundsInfo = {
        expected: expectedBounds,
        actual: actualBounds,
        offset,
        displayId: display.id,
        isPrimary,
      };

      this.displayBoundsInfo.set(display.id, boundsInfo);

      console.log(
        `[OverlayManager] Display ${display.id} final bounds: x=${actualBounds.x}, y=${actualBounds.y}, ${actualBounds.width}x${actualBounds.height}`
      );

      if (offset.x !== 0 || offset.y !== 0) {
        console.warn(
          `[OverlayManager] Display ${display.id} OS constrained position! Offset: (${offset.x}, ${offset.y})`
        );
      }

      boundsReady = true;
      sendBoundsIfReady();
    });

    browserWindow.webContents.once('did-finish-load', () => {
      if (browserWindow.isDestroyed()) return;

      pageLoaded = true;
      sendBoundsIfReady();
    });

    return browserWindow;
  }

  /**
   * Get the primary display's bounds info (backward compatibility)
   */
  public getContainerBoundsInfo(): ContainerBoundsInfo | null {
    const primaryDisplay = screen.getPrimaryDisplay();
    return this.displayBoundsInfo.get(primaryDisplay.id) ?? null;
  }

  /**
   * Toggle edit mode - enables/disables mouse interaction with overlays
   */
  public toggleLockOverlays(): boolean {
    this.isLocked = !this.isLocked;

    for (const win of this.displayWindows.values()) {
      if (win.isDestroyed()) continue;
      win.setIgnoreMouseEvents(this.isLocked);
      win.webContents.send('editModeToggled', !this.isLocked);
      if (!this.isLocked) {
        win.focus();
      }
    }

    return this.isLocked;
  }

  /**
   * Send a message to the container window and settings window
   */
  // High-frequency messages that only the overlay container needs
  private static readonly OVERLAY_ONLY_MESSAGES = new Set([
    'telemetry',
    'sessionData',
    'runningState',
  ]);

  public publishMessage(key: string, value: unknown): void {
    // Send to all display overlay windows
    for (const win of this.displayWindows.values()) {
      if (win.isDestroyed()) continue;
      try {
        win.webContents.send(key, value);
      } catch (e) {
        console.error(`Failed to send message ${key} to overlay window`, e);
      }
    }

    // Skip high-frequency telemetry messages for the settings window
    if (OverlayManager.OVERLAY_ONLY_MESSAGES.has(key)) {
      return;
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
   * Close all display overlay windows
   */
  public closeAllOverlays(): void {
    for (const win of this.displayWindows.values()) {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
    this.displayWindows.clear();
    this.displayBoundsInfo.clear();
  }

  /**
   * Create windows for any displays that need them but don't have one yet.
   * Uses widget center-point assignment (same logic as createOverlays) to
   * determine which displays are required. Safe to call during drag operations
   * since it never destroys existing windows.
   */
  public ensureDisplayWindows(dashboardLayout: DashboardLayout): void {
    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    const displaysWithWidgets = new Set<number>();
    for (const widget of dashboardLayout.widgets) {
      if (!widget.enabled) continue;
      const centerX = widget.layout.x + widget.layout.width / 2;
      const centerY = widget.layout.y + widget.layout.height / 2;
      for (const display of allDisplays) {
        const { x, y, width, height } = display.bounds;
        if (
          centerX >= x &&
          centerX < x + width &&
          centerY >= y &&
          centerY < y + height
        ) {
          displaysWithWidgets.add(display.id);
          break;
        }
      }
    }
    displaysWithWidgets.add(primaryDisplay.id);

    for (const display of allDisplays) {
      if (!displaysWithWidgets.has(display.id)) continue;
      const existing = this.displayWindows.get(display.id);
      if (existing && !existing.isDestroyed()) continue;
      const isPrimary = display.id === primaryDisplay.id;
      this.createWindowForDisplay(display, isPrimary);
    }
  }

  /**
   * Ensure at least one overlay window exists per active display.
   * Widget visibility is handled by the React OverlayContainer.
   */
  public closeOrCreateWindows(dashboardLayout?: DashboardLayout): void {
    if (dashboardLayout) {
      this.ensureDisplayWindows(dashboardLayout);
      return;
    }
    if (this.displayWindows.size === 0) {
      const allDisplays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();
      for (const display of allDisplays) {
        const isPrimary = display.id === primaryDisplay.id;
        this.createWindowForDisplay(display, isPrimary);
      }
    }
  }

  /**
   * Force refresh by closing all overlay windows and recreating them
   */
  public forceRefreshOverlays(dashboardLayout?: DashboardLayout): void {
    this.closeAllOverlays();
    if (dashboardLayout) {
      this.createOverlays(dashboardLayout);
    } else {
      const allDisplays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();
      for (const display of allDisplays) {
        const isPrimary = display.id === primaryDisplay.id;
        this.createWindowForDisplay(display, isPrimary);
      }
    }
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
    const defaultOptions: BrowserWindowConstructorOptions = {
      title: `irDashies - Settings`,
      frame: true,
      width: 800,
      height: 700,
      autoHideMenuBar: true,
      acceptFirstMouse: true,
      icon: getIconPath(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling: false,
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
          title: 'irDashies',
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
