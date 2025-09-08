import { app, BrowserWindow } from 'electron';
import type { DashboardLayout, DashboardWidget, Telemetry, TelemetryDelta, OverlayTelemetryPayload } from '@irdashies/types';
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

  // Telemetry subscription management
  private fieldSubscriptions: Map<string, Set<keyof Telemetry>>;
  private fieldToOverlays: Map<keyof Telemetry, Set<string>>;

  constructor() {
    this.fieldSubscriptions = new Map<string, Set<keyof Telemetry>>();
    this.fieldToOverlays = new Map<keyof Telemetry, Set<string>>();

    setInterval(() => {
      this.getOverlays().forEach(({ window }) => {
        if (window.isDestroyed()) return;
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

  // Telemetry subscription management methods
  public subscribeToTelemetryFields(overlayId: string, fields: (keyof Telemetry)[]): void {
    // Remove existing subscriptions for this overlay
    this.unsubscribeFromTelemetryFields(overlayId);

    // Add new subscriptions
    const fieldSet = new Set(fields);
    this.fieldSubscriptions.set(overlayId, fieldSet);

    // Update reverse mapping (field -> overlays)
    for (const field of fields) {
      let overlays = this.fieldToOverlays.get(field);
      if (!overlays) {
        overlays = new Set();
        this.fieldToOverlays.set(field, overlays);
      }
      overlays.add(overlayId);
    }

    console.log(`Overlay ${overlayId} subscribed to ${fields.length} telemetry fields`);
  }

  public unsubscribeFromTelemetryFields(overlayId: string, fields?: (keyof Telemetry)[]): void {
    const subscribedFields = this.fieldSubscriptions.get(overlayId);
    if (!subscribedFields) return;

    const fieldsToRemove = fields ? new Set(fields) : subscribedFields;

    // Remove from reverse mapping
    for (const field of fieldsToRemove) {
      const overlays = this.fieldToOverlays.get(field);
      if (overlays) {
        overlays.delete(overlayId);
        if (overlays.size === 0) {
          this.fieldToOverlays.delete(field);
        }
      }
    }

    // Update or remove subscription
    if (fields) {
      // Remove specific fields
      for (const field of fields) {
        subscribedFields.delete(field);
      }
      if (subscribedFields.size === 0) {
        this.fieldSubscriptions.delete(overlayId);
      }
    } else {
      // Remove all fields for this overlay
      this.fieldSubscriptions.delete(overlayId);
    }

    console.log(`Overlay ${overlayId} unsubscribed from telemetry fields`);
  }

  public getSubscribedFields(): Set<keyof Telemetry> {
    const allFields = new Set<keyof Telemetry>();
    for (const fields of this.fieldSubscriptions.values()) {
      for (const field of fields) {
        allFields.add(field);
      }
    }
    return allFields;
  }

  public getOverlaysForField(field: keyof Telemetry): string[] {
    const overlays = this.fieldToOverlays.get(field);
    return overlays ? Array.from(overlays) : [];
  }

  public getFieldsForOverlay(overlayId: string): Set<keyof Telemetry> {
    return this.fieldSubscriptions.get(overlayId) || new Set();
  }

  // New telemetry publishing method with field subscriptions
  public publishTelemetryFields(telemetry: Telemetry): void {
    if (this.fieldSubscriptions.size === 0) {
      // Fallback to legacy publishing if no subscriptions exist
      this.publishMessage('telemetry', telemetry);
      return;
    }

    // Group telemetry by overlay
    const overlayTelemetry = new Map<string, TelemetryDelta>();
    const timestamp = Date.now();

    // Build overlay-specific telemetry payloads
    for (const [field, fieldValue] of Object.entries(telemetry)) {
      const typedField = field as keyof Telemetry;
      const overlays = this.fieldToOverlays.get(typedField);

      if (overlays && fieldValue) {
        for (const overlayId of overlays) {
          let overlayPayload = overlayTelemetry.get(overlayId);
          if (!overlayPayload) {
            overlayPayload = {};
            overlayTelemetry.set(overlayId, overlayPayload);
          }
          (overlayPayload as Record<string, unknown>)[typedField] = fieldValue;
        }
      }
    }

    // Send targeted telemetry to each overlay
    let totalMessages = 0;
    for (const [overlayId, telemetrySubset] of overlayTelemetry) {
      const window = this.overlayWindows[overlayId]?.window;
      if (window && !window.isDestroyed()) {
        const payload: OverlayTelemetryPayload = {
          overlayId,
          telemetry: telemetrySubset,
          timestamp
        };
        window.webContents.send('telemetry', payload);
        totalMessages++;
      }
    }

    // Performance logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Published targeted telemetry: ${totalMessages} messages to ${overlayTelemetry.size} overlays`);
    }
  }

  public publishMessage(key: string, value: unknown): void {
    this.getOverlays().forEach(({ window }) => {
      if (window.isDestroyed()) return;
      // notifies the overlay windows that there's a dashboard settings/layout update
      window.webContents.send(key, value);
    });
    this.currentSettingsWindow?.webContents.send(key, value);
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
        // Clean up telemetry subscriptions when overlay is removed
        this.unsubscribeFromTelemetryFields(widget.id);
      }
    });

    widgets.forEach((widget) => {
      if (!widget.enabled) return; // skip disabled widgets
      if (!this.overlayWindows[widget.id]) {
        this.createOverlayWindow(widget);
      }
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
