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
import logger from './logger';

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
  private displayFullBounds = new Map<number, Electron.Rectangle>();
  private currentSettingsWindow: BrowserWindow | undefined;
  private gantryWindow: BrowserWindow | undefined;
  private currentDashboard: DashboardLayout | undefined;
  private isLocked = true;
  private isQuitting = false;
  private hasInteractiveWidgets = false;
  private skipTaskbar = true;
  private overlayAlwaysOnTop = true;
  private hasSingleInstanceLock = false;
  private onWindowReadyCallbacks = new Set<(windowId: string) => void>();

  /** Padding around the widget bounding box when shrink-wrapping */
  private static readonly SHRINK_WRAP_PADDING = 20;

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
    this.currentDashboard = dashboardLayout;
    const { generalSettings } = dashboardLayout;
    this.skipTaskbar = generalSettings?.skipTaskbar ?? true;
    this.overlayAlwaysOnTop = generalSettings?.overlayAlwaysOnTop ?? true;

    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    logger.info(`[OverlayManager] Found ${allDisplays.length} display(s):`);
    for (const display of allDisplays) {
      const isPrimary = display.id === primaryDisplay.id;
      logger.info(
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

    this.hasInteractiveWidgets = dashboardLayout.widgets.some(
      (w) => w.id !== 'gantry' && w.enabled && w.config?.interactive === true
    );

    for (const display of allDisplays) {
      if (!displaysWithWidgets.has(display.id)) {
        logger.info(
          `[OverlayManager] Skipping display ${display.id} — no widgets assigned`
        );
        continue;
      }
      const isPrimary = display.id === primaryDisplay.id;
      this.createWindowForDisplay(
        display,
        isPrimary,
        this.hasInteractiveWidgets
      );
    }

    this.createSettingsWindow();
    this.createGantryWindow(dashboardLayout);
  }

  /**
   * Create a transparent overlay window sized exactly to one display
   */
  private createWindowForDisplay(
    display: Electron.Display,
    isPrimary: boolean,
    hasInteractiveWidgets = false
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

    // Store full display bounds for shrink-wrap / expand toggling
    this.displayFullBounds.set(display.id, { ...expectedBounds });

    logger.info(
      `[OverlayManager] Creating window for display ${display.id}${isPrimary ? ' (PRIMARY)' : ''}: x=${expectedBounds.x}, y=${expectedBounds.y}, ${expectedBounds.width}x${expectedBounds.height}`
    );

    const browserWindow = new BrowserWindow({
      x: expectedBounds.x,
      y: expectedBounds.y,
      width: expectedBounds.width,
      height: expectedBounds.height,
      title: `irDashies - ${display.id}${isPrimary ? ' (Primary)' : ''})`,
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

    if (hasInteractiveWidgets) {
      browserWindow.setIgnoreMouseEvents(false);
    } else {
      browserWindow.setIgnoreMouseEvents(true, { forward: true });
    }
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
      logger.info(`Display ${display.id} overlay window closed`);
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

      // Apply shrink-wrap after initial setup when not in edit mode
      if (this.isLocked) {
        this.updateOverlayBounds();
      }
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
        displayBounds: { ...expectedBounds },
      };

      this.displayBoundsInfo.set(display.id, boundsInfo);

      logger.info(
        `[OverlayManager] Display ${display.id} final bounds: x=${actualBounds.x}, y=${actualBounds.y}, ${actualBounds.width}x${actualBounds.height}`
      );

      if (offset.x !== 0 || offset.y !== 0) {
        logger.warn(
          `[OverlayManager] Display ${display.id} OS constrained position! Offset: (${offset.x}, ${offset.y})`
        );
      }

      boundsReady = true;
      sendBoundsIfReady();
    });

    browserWindow.webContents.on('did-finish-load', () => {
      if (browserWindow.isDestroyed()) return;

      if (!pageLoaded) {
        // First load: coordinate with ready-to-show before sending bounds
        pageLoaded = true;
        sendBoundsIfReady();
      } else {
        // Subsequent reload (e.g., Vite HMR after a branch switch in dev mode).
        // Re-send containerBoundsInfo and re-trigger ready callbacks so the SDK
        // bridge re-sends runningState/telemetry/sessionData to the reloaded renderer.
        const boundsInfo = this.displayBoundsInfo.get(display.id);
        if (boundsInfo) {
          browserWindow.webContents.send('containerBoundsInfo', boundsInfo);
        }
        this.onWindowReadyCallbacks.forEach((cb) =>
          cb(`display-${display.id}`)
        );
      }
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
   * Compute the bounding box of all enabled widgets assigned to a given display.
   * Returns null if there are no widgets for the display.
   */
  private computeWidgetBounds(
    displayId: number,
    dashboard: DashboardLayout,
    displayBounds: Electron.Rectangle
  ): Electron.Rectangle | null {
    const primaryDisplay = screen.getPrimaryDisplay();
    const isPrimary = displayId === primaryDisplay.id;

    const enabledWidgets = dashboard.widgets.filter((w) => w.enabled);
    const widgetsForDisplay = enabledWidgets.filter((widget) => {
      const centerX = widget.layout.x + widget.layout.width / 2;
      const centerY = widget.layout.y + widget.layout.height / 2;
      const inThisDisplay =
        centerX >= displayBounds.x &&
        centerX < displayBounds.x + displayBounds.width &&
        centerY >= displayBounds.y &&
        centerY < displayBounds.y + displayBounds.height;
      return inThisDisplay || (!inThisDisplay && isPrimary);
    });

    if (widgetsForDisplay.length === 0) return null;

    const pad = OverlayManager.SHRINK_WRAP_PADDING;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const widget of widgetsForDisplay) {
      minX = Math.min(minX, widget.layout.x);
      minY = Math.min(minY, widget.layout.y);
      maxX = Math.max(maxX, widget.layout.x + widget.layout.width);
      maxY = Math.max(maxY, widget.layout.y + widget.layout.height);
    }

    // Clamp to display bounds
    const x = Math.max(displayBounds.x, Math.floor(minX - pad));
    const y = Math.max(displayBounds.y, Math.floor(minY - pad));
    const right = Math.min(
      displayBounds.x + displayBounds.width,
      Math.ceil(maxX + pad)
    );
    const bottom = Math.min(
      displayBounds.y + displayBounds.height,
      Math.ceil(maxY + pad)
    );

    return { x, y, width: right - x, height: bottom - y };
  }

  /**
   * Shrink-wrap or expand overlay windows based on edit mode.
   * When locked (not editing), windows shrink to the bounding box of their widgets.
   * When unlocked (editing), windows expand to full display bounds.
   */
  public updateOverlayBounds(dashboard?: DashboardLayout): void {
    if (dashboard) {
      this.currentDashboard = dashboard;
    }
    if (!this.currentDashboard) return;

    for (const [displayId, win] of this.displayWindows.entries()) {
      if (win.isDestroyed()) continue;

      const fullBounds = this.displayFullBounds.get(displayId);
      if (!fullBounds) continue;

      let targetBounds: Electron.Rectangle;

      if (!this.isLocked) {
        // Edit mode: expand to full display
        targetBounds = fullBounds;
      } else {
        // Locked: shrink-wrap to widget bounding box
        const widgetBounds = this.computeWidgetBounds(
          displayId,
          this.currentDashboard,
          fullBounds
        );
        targetBounds = widgetBounds ?? fullBounds;
      }

      const currentBounds = win.getBounds();
      if (
        currentBounds.x === targetBounds.x &&
        currentBounds.y === targetBounds.y &&
        currentBounds.width === targetBounds.width &&
        currentBounds.height === targetBounds.height
      ) {
        continue;
      }

      win.setBounds(targetBounds);

      const actualBounds = win.getBounds();
      const boundsInfo = this.displayBoundsInfo.get(displayId);
      if (boundsInfo) {
        boundsInfo.expected = targetBounds;
        boundsInfo.actual = actualBounds;
        boundsInfo.offset = {
          x: actualBounds.x - targetBounds.x,
          y: actualBounds.y - targetBounds.y,
        };
        win.webContents.send('containerBoundsInfo', boundsInfo);
      }
    }
  }

  /**
   * Toggle edit mode - enables/disables mouse interaction with overlays
   */
  public toggleLockOverlays(): boolean {
    this.isLocked = !this.isLocked;

    if (!this.isLocked) {
      this.updateOverlayBounds();
    }

    for (const win of this.displayWindows.values()) {
      if (win.isDestroyed()) continue;
      if (this.isLocked) {
        // Restore correct mouse state after exiting edit mode
        if (this.hasInteractiveWidgets) {
          win.setIgnoreMouseEvents(false);
        } else {
          win.setIgnoreMouseEvents(true, { forward: true });
        }
      } else {
        // Entering edit mode: allow mouse events for drag-to-position
        win.setIgnoreMouseEvents(false);
        win.focus();
      }
      win.webContents.send('editModeToggled', !this.isLocked);
    }

    if (this.isLocked) {
      this.updateOverlayBounds();
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

  // Debug: IPC timing stats (dev only)
  private ipcTimings: Record<string, { total: number; count: number }> = {};
  private ipcLogTimer: NodeJS.Timeout | null = null;

  private trackIpcTime(key: string, ms: number) {
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) return;
    if (!this.ipcTimings[key]) this.ipcTimings[key] = { total: 0, count: 0 };
    this.ipcTimings[key].total += ms;
    this.ipcTimings[key].count++;
    if (!this.ipcLogTimer) {
      this.ipcLogTimer = setInterval(() => {
        this.ipcTimings = {};
      }, 5000);
    }
  }

  public publishMessage(key: string, value: unknown): void {
    // Send to all display overlay windows
    for (const win of this.displayWindows.values()) {
      if (win.isDestroyed()) continue;
      try {
        const t0 = performance.now();
        win.webContents.send(key, value);
        this.trackIpcTime(`overlay:${key}`, performance.now() - t0);
      } catch (e) {
        logger.error(`Failed to send message ${key} to overlay window`, e);
      }
    }

    // Send to gantry window (needs telemetry/session, so send before the guard)
    if (this.gantryWindow && !this.gantryWindow.isDestroyed()) {
      try {
        const t0 = performance.now();
        this.gantryWindow.webContents.send(key, value);
        this.trackIpcTime(`gantry:${key}`, performance.now() - t0);
      } catch (e) {
        logger.error(`Failed to send message ${key} to gantry window`, e);
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
        logger.error(`Failed to send message ${key} to settings window`, e);
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
    this.displayFullBounds.clear();
  }

  public markQuitting(): void {
    this.isQuitting = true;
  }

  public quitApp(): void {
    if (this.isQuitting) return;

    this.isQuitting = true;
    this.closeAllOverlays();

    if (
      this.currentSettingsWindow &&
      !this.currentSettingsWindow.isDestroyed()
    ) {
      this.currentSettingsWindow.destroy();
      this.currentSettingsWindow = undefined;
    }

    app.quit();
  }

  /**
   * Create windows for any displays that need them but don't have one yet.
   * Uses widget center-point assignment (same logic as createOverlays) to
   * determine which displays are required. Safe to call during drag operations
   * since it never destroys existing windows.
   */
  public ensureDisplayWindows(dashboardLayout: DashboardLayout): void {
    this.currentDashboard = dashboardLayout;
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
      this.createWindowForDisplay(
        display,
        isPrimary,
        this.hasInteractiveWidgets
      );
    }

    // Shrink-wrap windows when not in edit mode
    if (this.isLocked) {
      this.updateOverlayBounds();
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
        this.createWindowForDisplay(
          display,
          isPrimary,
          this.hasInteractiveWidgets
        );
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
        this.createWindowForDisplay(
          display,
          isPrimary,
          this.hasInteractiveWidgets
        );
      }
    }
  }

  public focusSettingsWindow(): void {
    if (
      !this.currentSettingsWindow ||
      this.currentSettingsWindow.isDestroyed()
    ) {
      this.currentSettingsWindow = this.createSettingsWindow();
    } else {
      const win = this.currentSettingsWindow;
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
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

  private shouldCloseToTray(): boolean {
    const dashboard = getDashboard('default');
    return dashboard?.generalSettings?.closeToTray ?? true;
  }

  private notifyTrayAccessOnce(): void {
    const trayNotificationShown = readData<boolean>('trayNotificationShown');
    if (trayNotificationShown) return;

    new Notification({
      title: 'irDashies',
      body: 'Settings window is still accessible via the system tray icon',
    }).show();
    writeData('trayNotificationShown', true);
  }

  /**
   * Setup a single instance lock for the application. If the application is already running, it will quit the new instance.
   * @returns true if the lock was obtained, false otherwise
   */
  public setupSingleInstanceLock(): boolean {
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      logger.warn('[OverlayManager] Failed to get single instance lock.');
      const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
      if (!isDev) {
        app.quit();
        this.hasSingleInstanceLock = false;
        return false;
      }
      // In dev mode, we allow it to continue because Forge might not have
      // fully killed the previous process's lock yet.
      logger.warn('[OverlayManager] Dev mode detected, continuing anyway...');
      this.hasSingleInstanceLock = true;
      return true;
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

  public createGantryWindow(dashboardLayout?: DashboardLayout): void {
    const gantryWidget = dashboardLayout?.widgets.find(
      (w) => w.id === 'gantry'
    );
    if (!gantryWidget?.enabled) return;

    if (this.gantryWindow && !this.gantryWindow.isDestroyed()) {
      this.gantryWindow.show();
      return;
    }

    const browserWindow = new BrowserWindow({
      title: 'irDashies - Gantry',
      frame: true,
      width: 1400,
      height: 800,
      autoHideMenuBar: true,
      icon: getIconPath(),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling: false,
      },
    });

    this.gantryWindow = browserWindow;

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      browserWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/gantry`);
    } else {
      browserWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: '/gantry' }
      );
    }

    browserWindow.on('closed', () => {
      this.gantryWindow = undefined;
    });
  }

  public createSettingsWindow(): BrowserWindow {
    if (this.currentSettingsWindow) {
      if (this.currentSettingsWindow.isMinimized()) {
        this.currentSettingsWindow.restore();
      }
      this.currentSettingsWindow.show();
      this.currentSettingsWindow.focus();
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

    browserWindow.on('close', (event) => {
      if (this.isQuitting) return;

      if (this.shouldCloseToTray()) {
        event.preventDefault();
        browserWindow.hide();
        this.notifyTrayAccessOnce();
        return;
      }

      this.quitApp();
    });

    browserWindow.on('closed', () => {
      this.currentSettingsWindow = undefined;
    });

    return browserWindow;
  }
}

function loadWindowBounds(): Electron.Rectangle | undefined {
  return readData<Electron.Rectangle>('settingsWindowBounds');
}
