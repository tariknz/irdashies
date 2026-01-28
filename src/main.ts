import { app } from 'electron';
import { iRacingSDKSetup, getCurrentBridge } from './app/bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar } from './app';
import { publishDashboardUpdates, dashboardBridge } from './app/bridge/dashboard/dashboardBridge';
import { setupPitLaneBridge } from './app/bridge/pitLaneBridge';
import { TelemetrySink } from './app/bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './app/overlayManager';
import { startComponentServer } from './app/webserver/componentServer';
import { updateElectronApp } from 'update-electron-app';
// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';
import { Analytics } from './app/analytics';
import { registerHideUiShortcut } from './frontend/utils/globalShortcuts';
import { FuelDatabase } from './app/storage/fuelDatabase';
import { ipcMain } from 'electron';
import { FuelLapData } from './types/fuelCalculatorBridge';

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

  // Initialize Fuel Database and register IPC handlers as soon as possible
  const fuelDb = new FuelDatabase();

  ipcMain.handle('fuel:getHistoricalLaps', (_, trackId: number, carName: string) => {
    console.log(`[Main] Fetching historical laps for ${carName} at track ${trackId}`);
    return fuelDb.getLaps(trackId, carName);
  });

  ipcMain.handle('fuel:saveLap', (_, trackId: number, carName: string, lap: FuelLapData) => {
    console.log(`[Main] Saving lap ${lap.lapNumber} for ${carName} at track ${trackId}`);
    return fuelDb.saveLap(trackId, carName, lap);
  });

  ipcMain.handle('fuel:clearHistory', (_, trackId: number, carName: string) => {
    console.log(`[Main] Clearing history for ${carName} at track ${trackId}`);
    return fuelDb.clearLaps(trackId, carName);
  });

  ipcMain.handle('fuel:clearAllHistory', () => {
    console.log('[Main] Received fuel:clearAllHistory request');
    try {
      fuelDb.clearAllLaps();
      console.log('[Main] fuel:clearAllHistory successful');
      return true;
    } catch (e) {
      console.error('[Main] fuel:clearAllHistory failed:', e);
      throw e;
    }
  });

  ipcMain.handle('fuel:getQualifyMax', (_, trackId: number, carName: string) => {
    console.log(`[Main] Fetching QualifyMax for ${carName} at track ${trackId}`);
    return fuelDb.getQualifyMax(trackId, carName);
  });

  ipcMain.handle('fuel:saveQualifyMax', (_, trackId: number, carName: string, val: number | null) => {
    console.log(`[Main] Saving QualifyMax (${val}) for ${carName} at track ${trackId}`);
    return fuelDb.saveQualifyMax(trackId, carName, val);
  });

  app.on('quit', () => {
    fuelDb.close();
  });

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
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => {
  console.log('App quit');
  analytics.shutdown();
});
