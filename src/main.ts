import { app } from 'electron';
import { iRacingSDKSetup, getCurrentBridge } from './app/bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar } from './app';
import { publishDashboardUpdates, dashboardBridge } from './app/bridge/dashboard/dashboardBridge';
import { TelemetrySink } from './app/bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './app/overlayManager';
import { startComponentServer } from './app/bridge/componentServer';
import { updateElectronApp } from 'update-electron-app';
// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

updateElectronApp();

const overlayManager = new OverlayManager();
const telemetrySink = new TelemetrySink();

overlayManager.setupSingleInstanceLock();

app.on('ready', async () => {
  await iRacingSDKSetup(telemetrySink, overlayManager);

  const dashboard = getOrCreateDefaultDashboard();
  const bridge = getCurrentBridge();

  // Start component server for browser components
  await startComponentServer(bridge, dashboardBridge);

  overlayManager.createOverlays(dashboard);
  setupTaskbar(telemetrySink, overlayManager);
  publishDashboardUpdates(overlayManager);
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => console.warn('App quit'));
