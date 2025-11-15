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
  // Start component server - pass bridge after SDK setup
  await iRacingSDKSetup(telemetrySink, overlayManager);
  const bridge = getCurrentBridge();
  await startComponentServer(bridge, dashboardBridge);

  const dashboard = getOrCreateDefaultDashboard();
  overlayManager.createOverlays(dashboard);

  setupTaskbar(telemetrySink, overlayManager);
  publishDashboardUpdates(overlayManager);
  
  // Send initial dashboard to component server bridge
  console.log('📊 Sending initial dashboard to component server');
  const { emitDashboardUpdated } = await import('./app/storage/dashboardEvents');
  emitDashboardUpdated(dashboard);
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => console.warn('App quit'));
