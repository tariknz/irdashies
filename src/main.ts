import { app, ipcMain } from 'electron';
import log from './app/logger';
import {
  iRacingSDKSetup,
  getCurrentBridge,
  getSessionLifecycle,
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
import { createPerfDashboard, getPerfRunConfig } from './app/perfRunConfig';
import { ChannelBus, setupChannelBridge } from './app/bridge/channelBridge';
import { connectSessionLifecycleChannel } from './app/bridge/sessionLifecycleChannel';
import { setupLegacyRendererSubscriptions } from './app/bridge/legacyRendererSubscriptions';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

updateElectronApp();

const overlayManager = new OverlayManager();
const analytics = new Analytics();
const perfRun = getPerfRunConfig();
analytics.setupLogTransport();

overlayManager.setupChromiumFlags();
overlayManager.setupHardwareAcceleration();
overlayManager.setupSingleInstanceLock();
overlayManager.setupAutoStart();

// Hoisted so the quit handler can tear down the WebHID host window cleanly.
let keybindingManager: KeybindingManager | undefined;
const channelBus = new ChannelBus();
let disconnectLifecycleChannel: (() => void) | undefined;

app.on('ready', async () => {
  // Don't start services if we don't have the single instance lock
  // (this instance should be quitting)
  if (!overlayManager.hasLock()) {
    return;
  }

  if (perfRun.enabled) {
    log.info('[PerfRun] Configuration', perfRun);
    if (perfRun.durationSeconds > 0) {
      setTimeout(() => {
        log.info(
          `[PerfRun] Completed fixed ${perfRun.durationSeconds}s capture`
        );
        app.quit();
      }, perfRun.durationSeconds * 1000);
    }
  }

  setupChannelBridge(channelBus);
  setupLegacyRendererSubscriptions(overlayManager);
  disconnectLifecycleChannel = connectSessionLifecycleChannel(
    getSessionLifecycle(),
    channelBus
  );
  await iRacingSDKSetup(overlayManager, channelBus);

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
  await startComponentServer(bridge, dashboardBridge, channelBus);

  ipcMain.handle('getComponentServerPort', () => getComponentServerPort());

  const runDashboard = createPerfDashboard(dashboard, perfRun);
  if (!perfRun.enabled || perfRun.overlayMode !== 'observer') {
    // Empty mode keeps the normal overlay window count/bounds while the
    // renderer receives a dashboard with every widget disabled. This isolates
    // transparent-window/global-provider cost from widget rendering.
    const windowDashboard =
      perfRun.enabled && perfRun.overlayMode === 'empty'
        ? dashboard
        : runDashboard;
    overlayManager.createOverlays(windowDashboard, {
      createSettingsWindow: !perfRun.enabled,
    });
  }

  keybindingManager = new KeybindingManager(overlayManager);
  keybindingManager.registerAll();
  // Start the WebHID host window that reads game controllers for gamepad bindings.
  if (!perfRun.enabled) {
    keybindingManager.startGamepad();
  }

  setupTaskbar(overlayManager, keybindingManager);
  await publishDashboardUpdates(
    overlayManager,
    analytics,
    perfRun.enabled
      ? (updatedDashboard) => createPerfDashboard(updatedDashboard, perfRun)
      : undefined
  );
  setupKeybindingsBridge(keybindingManager);

  await analytics.init(overlayManager.getVersion(), dashboard);
});

app.on('window-all-closed', () => {
  if (perfRun.enabled && perfRun.overlayMode === 'observer') {
    return;
  }
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
  disconnectLifecycleChannel?.();
  channelBus.dispose();
  // Synchronous flush so any pending debounced reference-lap write completes
  // before the process exits.
  flushReferenceLapsOnShutdown();
});
