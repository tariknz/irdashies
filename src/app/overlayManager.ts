import { app, BrowserWindow, screen } from 'electron';
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
  private containerWindow: BrowserWindow | undefined;
  private currentSettingsWindow: BrowserWindow | undefined;
  private isLocked = true;
  private skipTaskbar = true;
  private overlayAlwaysOnTop = true;
  private hasSingleInstanceLock = false;
  private onWindowReadyCallbacks = new Set<(windowId: string) => void>();
  // Track container bounds for coordinate compensation
  private containerBoundsInfo: ContainerBoundsInfo | null = null;

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
   * Spans across all connected monitors
   */
  private createContainerWindow(): BrowserWindow {
    if (this.containerWindow && !this.containerWindow.isDestroyed()) {
      return this.containerWindow;
    }

    // Calculate combined bounds of all displays to span all monitors
    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    // Log display info for debugging
    console.log(`[OverlayManager] Found ${allDisplays.length} display(s):`);
    for (const display of allDisplays) {
      const isPrimary = display.id === primaryDisplay.id;
      console.log(
        `  Display ${display.id}${isPrimary ? ' (PRIMARY)' : ''}: bounds=${JSON.stringify(display.bounds)}`
      );
    }

    const bounds = this.calculateCombinedDisplayBounds(allDisplays);
    const expectedBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };

    console.log(
      `[OverlayManager] Creating container window at: x=${expectedBounds.x}, y=${expectedBounds.y}, ${expectedBounds.width}x${expectedBounds.height}`
    );

    const browserWindow = new BrowserWindow({
      x: expectedBounds.x,
      y: expectedBounds.y,
      width: expectedBounds.width,
      height: expectedBounds.height,
      title: 'iRacing Dashies - Overlay Container',
      transparent: true,
      frame: false,
      skipTaskbar: this.skipTaskbar,
      focusable: true, // for OpenKneeboard/VR
      resizable: false,
      movable: false,
      roundedCorners: false,
      hasShadow: false,
      show: false, // Don't show until ready
      alwaysOnTop: true, // Set in constructor for better Windows compatibility
      backgroundColor: '#00000000', // Explicit transparent background
      enableLargerThanScreen: true, // Allow window to span multiple monitors
      icon: getIconPath(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Force set bounds after creation - more reliable on Windows
    browserWindow.setBounds(expectedBounds);

    browserWindow.on('page-title-updated', (evt) => {
      evt.preventDefault();
    });

    // Enable click-through with event forwarding for edit mode
    browserWindow.setIgnoreMouseEvents(true, { forward: true });
    browserWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });

    if (this.overlayAlwaysOnTop) {
      // Use 'screen-saver' level to stay above fullscreen games
      // This is the highest z-order level available in Electron
      browserWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    // Check actual bounds vs expected after initial setup
    const initialBounds = browserWindow.getBounds();
    console.log(
      `[OverlayManager] Initial bounds after setBounds: x=${initialBounds.x}, y=${initialBounds.y}, ${initialBounds.width}x${initialBounds.height}`
    );

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
      this.containerBoundsInfo = null;
    });

    // Show window and retry positioning when ready
    browserWindow.once('ready-to-show', () => {
      if (browserWindow.isDestroyed()) return;

      // Retry setting bounds - Windows sometimes allows it after window is visible
      browserWindow.setPosition(expectedBounds.x, expectedBounds.y);
      browserWindow.setSize(expectedBounds.width, expectedBounds.height);
      browserWindow.show();

      // Check final bounds
      const actualBounds = browserWindow.getBounds();
      const offset = {
        x: actualBounds.x - expectedBounds.x,
        y: actualBounds.y - expectedBounds.y,
      };

      this.containerBoundsInfo = {
        expected: expectedBounds,
        actual: actualBounds,
        offset,
      };

      console.log(
        `[OverlayManager] Final window bounds: x=${actualBounds.x}, y=${actualBounds.y}, ${actualBounds.width}x${actualBounds.height}`
      );

      if (offset.x !== 0 || offset.y !== 0) {
        console.warn(
          `[OverlayManager] OS constrained window position! Offset: (${offset.x}, ${offset.y})`
        );
      }

      if (
        actualBounds.width !== expectedBounds.width ||
        actualBounds.height !== expectedBounds.height
      ) {
        console.warn(
          `[OverlayManager] Window size mismatch! Expected ${expectedBounds.width}x${expectedBounds.height}, got ${actualBounds.width}x${actualBounds.height}`
        );
      }
    });

    browserWindow.webContents.once('did-finish-load', () => {
      if (!browserWindow.isDestroyed()) {
        // Send container bounds info to the frontend
        browserWindow.webContents.send(
          'containerBoundsInfo',
          this.containerBoundsInfo
        );
        // Notify that the container is ready
        this.onWindowReadyCallbacks.forEach((cb) => cb('container'));
      }
    });

    return browserWindow;
  }

  /**
   * Get the container bounds info (expected vs actual position)
   */
  public getContainerBoundsInfo(): ContainerBoundsInfo | null {
    return this.containerBoundsInfo;
  }

  /**
   * Calculate the bounding rectangle that encompasses all displays
   * This creates one large virtual screen spanning all monitors
   */
  private calculateCombinedDisplayBounds(
    displays: Electron.Display[]
  ): Electron.Rectangle {
    if (displays.length === 0) {
      // Fallback to a default if no displays (shouldn't happen)
      return { x: 0, y: 0, width: 1920, height: 1080 };
    }

    if (displays.length === 1) {
      return displays[0].bounds;
    }

    // Find the bounding box that contains all displays
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const display of displays) {
      const { x, y, width, height } = display.bounds;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
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
  // High-frequency messages that only the overlay container needs
  private static readonly OVERLAY_ONLY_MESSAGES = new Set([
    'telemetry',
    'sessionData',
    'runningState',
  ]);

  public publishMessage(key: string, value: unknown): void {
    // Send to container window
    if (this.containerWindow && !this.containerWindow.isDestroyed()) {
      try {
        this.containerWindow.webContents.send(key, value);
      } catch (e) {
        console.error(`Failed to send message ${key} to container window`, e);
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

    // Set settings window to screen-saver level so it appears above the overlay
    // Use relative level 2 (higher than overlay's 1) so it's always clickable
    if (this.overlayAlwaysOnTop) {
      browserWindow.setAlwaysOnTop(true, 'screen-saver', 2);
    }

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
