import { app, globalShortcut } from 'electron';
import { iRacingSDKSetup, getCurrentBridge } from './app/bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar } from './app';
import { publishDashboardUpdates, dashboardBridge } from './app/bridge/dashboard/dashboardBridge';
import { TelemetrySink } from './app/bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './app/overlayManager';
import { startComponentServer } from './app/webserver/componentServer';
import { updateElectronApp } from 'update-electron-app';
// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

updateElectronApp();

const overlayManager = new OverlayManager();
const telemetrySink = new TelemetrySink();

overlayManager.setupHardwareAcceleration();
overlayManager.setupSingleInstanceLock();

app.on('ready', async () => {
  // Don't start services if we don't have the single instance lock
  // (this instance should be quitting)
  if (!overlayManager.hasLock()) {
    return;
  }

  await iRacingSDKSetup(telemetrySink, overlayManager);

  const dashboard = getOrCreateDefaultDashboard();
  const bridge = getCurrentBridge();

  // Start component server for browser components
  await startComponentServer(bridge, dashboardBridge);

  overlayManager.createOverlays(dashboard);
  setupTaskbar(telemetrySink, overlayManager);
  publishDashboardUpdates(overlayManager);
});

let hideState = false;

app.whenReady().then(() => {

  // Register a global accelerator. Recommended: use a modifier to avoid conflicts.
  // Examples: 'Alt+H', 'CommandOrControl+R', 'Ctrl+Alt+H'
  const accel = 'Alt+H';

  const registered = globalShortcut.register(accel, () => {
    // Toggle internal state and notify renderer
    hideState = !hideState;
    overlayManager.getOverlays().forEach(({ window }) => {
    window.webContents.send('global-toggle-hide', hideState);
  });
  });

  if (!registered) {
    console.error(`Failed to register global shortcut: ${accel}`);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregister('Alt+H');
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => console.warn('App quit'));
