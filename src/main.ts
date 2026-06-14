import { app, ipcMain } from 'electron';
import log from './app/logger';
import {
  iRacingSDKSetup,
  getCurrentBridge,
} from './app/bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar, KeybindingManager } from './app';
import {
  publishDashboardUpdates,
  dashboardBridge,
} from './app/bridge/dashboard/dashboardBridge';
import { setupPitLaneBridge } from './app/bridge/pitLaneBridge';
import { setupFuelCalculatorBridge } from './app/bridge/fuelCalculatorBridge';
import { OverlayManager } from './app/overlayManager';
import {
  startComponentServer,
  getComponentServerPort,
} from './app/webserver/componentServer';
import { updateElectronApp } from 'update-electron-app';
// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';
import { Analytics } from './app/analytics';
import { setupReferenceLapsBridge } from './app/bridge/referenceLapsBridge';
import { setupKeybindingsBridge } from './app/bridge/keybindingsBridge';
import { setupLogBridge } from './app/bridge/logBridge';
import { setupPersonalBestLapTimesBridge } from './app/bridge/personalBestLapTimesBridge';
import {
  validateReferenceLapFile,
  flushReferenceLapsOnShutdown,
} from './app/storage/referenceLaps';
import { setupChromiumFlagsBridge } from './app/bridge/chromiumFlagsBridge';
import {
  isVrOverlayEnabled,
  startVrOverlay,
  stopVrOverlay,
  applyVrOverlaySettings,
} from './app/vr/vrOverlay';
import { onDashboardUpdated } from './app/storage/dashboardEvents';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

updateElectronApp();

const overlayManager = new OverlayManager();
const analytics = new Analytics();
analytics.setupLogTransport();

// Hoisted so the quit handler can stop the gamepad poll thread cleanly.
let keybindingManager: KeybindingManager | undefined;

overlayManager.setupChromiumFlags();
overlayManager.setupHardwareAcceleration();
overlayManager.setupSingleInstanceLock();
overlayManager.setupAutoStart();

app.on('ready', async () => {
  // Don't start services if we don't have the single instance lock
  // (this instance should be quitting)
  if (!overlayManager.hasLock()) {
    return;
  }

  await iRacingSDKSetup(overlayManager);

  // Perform one-time cleanup of old reference laps
  validateReferenceLapFile();

  const dashboard = getOrCreateDefaultDashboard();
  const bridge = getCurrentBridge();

  // Setup IPC bridges
  setupLogBridge();
  setupFuelCalculatorBridge();
  setupPitLaneBridge();
  setupReferenceLapsBridge();
  setupPersonalBestLapTimesBridge();
  setupChromiumFlagsBridge();

  // Start component server for browser components
  await startComponentServer(bridge, dashboardBridge);

  ipcMain.handle('getComponentServerPort', () => getComponentServerPort());

  overlayManager.createOverlays(dashboard);

  // Experimental native VR overlay (opt-in via IRDASHIES_VR=1).
  if (isVrOverlayEnabled()) {
    startVrOverlay(overlayManager, dashboard?.generalSettings?.vr);
    // Push placement changes to the native layer in real time as the user
    // edits the VR settings section.
    onDashboardUpdated((updated) => {
      applyVrOverlaySettings(updated.generalSettings?.vr);
    });
  }

  keybindingManager = new KeybindingManager(overlayManager);
  keybindingManager.registerAll();
  // Begin polling game controllers for any gamepad bindings (lazy-loads SDL).
  keybindingManager.startGamepad();

  setupTaskbar(overlayManager, keybindingManager);
  publishDashboardUpdates(overlayManager, analytics);
  setupKeybindingsBridge(keybindingManager);

  await analytics.init(overlayManager.getVersion(), dashboard);

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('quit', () => {
  log.info('App quit');
  analytics.shutdown();
});

app.on('before-quit', () => {
  overlayManager.markQuitting();
  keybindingManager?.stopGamepad();
  stopVrOverlay();
  // Synchronous flush so any pending debounced reference-lap write completes
  // before the process exits.
  flushReferenceLapsOnShutdown();
});
