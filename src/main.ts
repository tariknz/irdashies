import { app } from 'electron';
import { iRacingSDKSetup } from './app/bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar } from './app';
import { publishDashboardUpdates } from './app/bridge/dashboard/dashboardBridge';
import { TelemetrySink } from './app/bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './app/overlayManager';
import { updateElectronApp } from 'update-electron-app';
// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

updateElectronApp();

const overlayManager = new OverlayManager();
const telemetrySink = new TelemetrySink();

app.on('ready', () => {
  const dashboard = getOrCreateDefaultDashboard();
  overlayManager.createOverlays(dashboard);

  setupTaskbar(telemetrySink, overlayManager);
  iRacingSDKSetup(telemetrySink, overlayManager);
  publishDashboardUpdates(overlayManager);
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => console.warn('App quit'));
