import { app } from 'electron';
import {
  iRacingSDKSetup,
  getCurrentBridge,
} from './app/bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar } from './app';
import {
  publishDashboardUpdates,
  dashboardBridge,
} from './app/bridge/dashboard/dashboardBridge';
import { setupPitLaneBridge } from './app/bridge/pitLaneBridge';
import { TelemetrySink } from './app/bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './app/overlayManager';
import { startComponentServer } from './app/webserver/componentServer';
import { updateElectronApp } from 'update-electron-app';
// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';
import { Analytics } from './app/analytics';
import { registerHideUiShortcut } from './app/globalShortcuts';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

updateElectronApp();

const overlayManager = new OverlayManager();
const telemetrySink = new TelemetrySink();
const analytics = new Analytics();

overlayManager.setupHardwareAcceleration();
overlayManager.setupSingleInstanceLock();
overlayManager.setupAutoStart();

app.on('ready', async () => {
  // Don't start services if we don't have the single instance lock
  // (this instance should be quitting)
  if (!overlayManager.hasLock()) {
    return;
  }

  await iRacingSDKSetup(telemetrySink, overlayManager);

  const dashboard = getOrCreateDefaultDashboard();
  const bridge = getCurrentBridge();

  // Setup IPC bridges
  setupPitLaneBridge();

  // Start component server for browser components
  await startComponentServer(bridge, dashboardBridge);

  overlayManager.createOverlays(dashboard);
  setupTaskbar(telemetrySink, overlayManager);
  publishDashboardUpdates(overlayManager, analytics);

  await analytics.init(overlayManager.getVersion(), dashboard);

  // 🔽 Register the global hide UI shortcut once everything is set up
  registerHideUiShortcut(overlayManager);

  // Check if settings window should start minimized
  const shouldStartMinimized =
    dashboard?.generalSettings?.startMinimized ?? false;
  if (shouldStartMinimized) {
    // Create the settings window but don't show it immediately
    const settingsWindow = overlayManager.createSettingsWindow();
    // Minimize it to system tray
    settingsWindow.hide();
  }
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => {
  console.log('App quit');
  analytics.shutdown();
});
