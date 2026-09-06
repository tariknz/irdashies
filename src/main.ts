import { app, BrowserWindow, ipcMain } from 'electron';
import log from './app/logger';
import {
  iRacingSDKSetup,
  getCurrentBridge,
  getSessionLifecycle,
  onBridgeChanged,
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
import { setupKeybindingsBridge } from './app/bridge/keybindingsBridge';
import { setupLogBridge } from './app/bridge/logBridge';
import { setupPersonalBestLapTimesBridge } from './app/bridge/personalBestLapTimesBridge';
import {
  validateReferenceLapFile,
  flushReferenceLapsOnShutdown,
} from './app/storage/referenceLaps';
import { setupChromiumFlagsBridge } from './app/bridge/chromiumFlagsBridge';
import { setupRaceControlBridge } from './app/bridge/raceControlBridge';
import {
  flushIncidentsOnShutdown,
  appendIncident,
} from './app/storage/incidentStorage';
import {
  IncidentRuntime,
  type IncidentPersistence,
  type PerformanceSections,
} from './app/processors/incidentRuntime';
import {
  LapHistoryRuntime,
  type LapHistoryPersistence,
} from './app/processors/lapHistoryRuntime';
import {
  flushLapHistoryOnShutdown,
  loadLapHistory,
  pruneOldSessions as pruneOldLapHistorySessions,
  rehydrateLapHistory,
  saveLapHistory,
} from './app/storage/lapHistoryStorage';
import { onDashboardUpdated } from './app/storage/dashboardEvents';
import type { DashboardLayout } from '@irdashies/types';
import { getActivePerfMetrics } from './app/perfMetrics';
import {
  activePerfWidgetTypes,
  createPerfDashboard,
  getPerfRunConfig,
  PERF_CAPTURE_ORIGIN_LOG_PREFIX,
  PERF_VISIBILITY_LOG_PREFIX,
} from './app/perfRunConfig';
import { ChannelBus, setupChannelBridge } from './app/bridge/channelBridge';
import { connectSessionLifecycleChannel } from './app/bridge/sessionLifecycleChannel';
import { setupRendererDataSubscriptions } from './app/bridge/rendererDataSubscriptions';
import { PerfHeapProfiler } from './app/perfHeapProfiler';
import { createBeforeQuitHandler } from './app/shutdownCoordinator';

const safeErrorDetails = (error: unknown) => {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : undefined;
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    ...(code ? { code } : {}),
  };
};

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
const channelBus = new ChannelBus({
  deliveryEnabled: !perfRun.enabled || perfRun.channelDelivery === 'on',
});
let disconnectLifecycleChannel: (() => void) | undefined;
let incidentRuntime: IncidentRuntime | undefined;
let disposeLapHistoryRuntime: (() => void) | undefined;
// Resolved per call: a runtime outlives any single SDK bridge, so it must
// not hold a reference to a metrics instance that has stopped reporting.
const runtimePerfMetrics: PerformanceSections = {
  markStart: (label) => getActivePerfMetrics()?.markStart(label),
  markEnd: (label) => getActivePerfMetrics()?.markEnd(label),
};
const incidentPersistence: IncidentPersistence = {
  save: (sessionId, incident) => {
    appendIncident(sessionId, incident).catch((err) =>
      log.error('[RaceControl] Failed to persist incident:', err)
    );
  },
};
const lapHistoryPersistence: LapHistoryPersistence = {
  save: (sessionId, snapshot) => {
    saveLapHistory(sessionId, snapshot).catch((err) =>
      log.error('[LapHistory] Failed to persist lap history:', err)
    );
  },
  load: async (sessionId) => {
    const stored = await loadLapHistory(sessionId);
    if (!stored) return null;
    return {
      sessionNum: stored.history.sessionNum,
      apply: (target) => rehydrateLapHistory(stored, target),
    };
  },
};
let disposeRendererDataSubscriptions: (() => void) | undefined;

/**
 * Hosts lap-history recording outside the ProcessorHost, the way the incident
 * runtime is hosted: an enabled Gantry keeps recording while its window is
 * closed. Gated on the Gantry widget, so a user who never enables it pays no
 * frame cost.
 */
function setupLapHistoryRuntime(initialDashboard: DashboardLayout): void {
  const runtime = new LapHistoryRuntime(
    channelBus,
    getSessionLifecycle(),
    runtimePerfMetrics,
    lapHistoryPersistence
  );

  const applyDashboard = (layout: DashboardLayout | undefined) => {
    const widget = layout?.widgets.find((w) => w.id === 'gantry');
    runtime.updateEnabled(widget?.enabled ?? false);
  };
  applyDashboard(initialDashboard);
  const unsubscribeDashboard = onDashboardUpdated(applyDashboard);

  let unsubscribeSession: (() => void) | undefined;
  let unsubscribeTelemetry: (() => void) | undefined;
  const wireToTelemetryBridge = () => {
    unsubscribeSession?.();
    unsubscribeTelemetry?.();
    const bridge = getCurrentBridge();
    if (!bridge) return;
    unsubscribeSession =
      bridge.onSessionData((session) => runtime.onSession(session)) ??
      undefined;
    unsubscribeTelemetry =
      bridge.onTelemetry((telemetry) => runtime.onFrame(telemetry)) ??
      undefined;
  };
  wireToTelemetryBridge();
  const unsubscribeBridgeChanged = onBridgeChanged(wireToTelemetryBridge);

  // Retention: the current race plus one previous race.
  const unsubscribeSessionId = runtime.onSessionIdChanged((sessionId) => {
    if (!sessionId) return;
    pruneOldLapHistorySessions(sessionId).catch((err) =>
      log.error('[LapHistory] Failed to prune old sessions:', err)
    );
  });

  // Every inbound subscription has to stop before the shutdown flush, or a late
  // frame can schedule a debounced write that the flush has already passed.
  disposeLapHistoryRuntime = () => {
    unsubscribeSession?.();
    unsubscribeTelemetry?.();
    unsubscribeSession = undefined;
    unsubscribeTelemetry = undefined;
    unsubscribeBridgeChanged?.();
    unsubscribeDashboard?.();
    unsubscribeSessionId?.();
    runtime.dispose();
  };
}

app.on('ready', async () => {
  // Don't start services if we don't have the single instance lock
  // (this instance should be quitting)
  if (!overlayManager.hasLock()) {
    return;
  }

  if (perfRun.enabled) {
    log.info('[PerfRun] Configuration', perfRun);
  }

  // Resolve benchmark metadata before metrics reporting starts so every
  // interval carries the same active-widget workload description.
  const dashboard = getOrCreateDefaultDashboard();
  const runDashboard = createPerfDashboard(dashboard, perfRun);
  if (perfRun.enabled) {
    process.env.PERF_ACTIVE_WIDGET_TYPES = JSON.stringify(
      activePerfWidgetTypes(runDashboard)
    );
  }

  setupChannelBridge(channelBus);
  const rendererDataSubscriptions = setupRendererDataSubscriptions({
    onSubscribe: (sender, stream) => {
      if (stream === 'sessionData') overlayManager.seedSessionData(sender);
    },
  });
  disposeRendererDataSubscriptions = rendererDataSubscriptions.dispose;
  overlayManager.setRendererDataSubscriptions(
    rendererDataSubscriptions.registry
  );
  disconnectLifecycleChannel = connectSessionLifecycleChannel(
    getSessionLifecycle(),
    channelBus
  );
  await iRacingSDKSetup(overlayManager, channelBus);

  // Perform one-time cleanup of old reference laps
  validateReferenceLapFile();

  const bridge = getCurrentBridge();

  // Setup IPC bridges
  setupLogBridge();
  setupFuelCalculatorBridge();
  setupPitLaneBridge();
  setupPersonalBestLapTimesBridge();
  setupChromiumFlagsBridge();
  incidentRuntime = new IncidentRuntime(
    channelBus,
    getSessionLifecycle(),
    runtimePerfMetrics,
    incidentPersistence,
    { isDev: !app.isPackaged }
  );
  setupRaceControlBridge(incidentRuntime, dashboard);
  setupLapHistoryRuntime(dashboard);
  // Returns false when the Gantry widget is disabled, so Settings can explain
  // why the button did nothing instead of appearing to be broken.
  ipcMain.handle('raceControl:showGantryWindow', () =>
    overlayManager.createGantryWindow(getOrCreateDefaultDashboard())
  );

  // Local-only feature modules (git-excluded src/local/). Empty glob => no-op.
  // The negative pattern keeps co-located *.spec.ts test files out of the bundle.
  const localMainModules = import.meta.glob(
    ['./local/main/*.ts', '!./local/main/*.spec.ts'],
    { eager: true }
  ) as Record<
    string,
    {
      register?: (deps: {
        overlayManager: OverlayManager;
      }) => void | Promise<void>;
    }
  >;
  for (const mod of Object.values(localMainModules)) {
    await mod.register?.({ overlayManager });
  }

  // Start component server for browser components
  await startComponentServer(bridge, dashboardBridge, channelBus);

  ipcMain.handle('getComponentServerPort', () => getComponentServerPort());

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

  if (perfRun.enabled) {
    const captureOriginMs = Date.now();
    const captureOrigin = new Date(captureOriginMs).toISOString();
    log.info(
      `${PERF_CAPTURE_ORIGIN_LOG_PREFIX}${JSON.stringify({
        timestamp: captureOrigin,
        runId: process.env.PERF_RUN_ID ?? 'manual',
      })}`
    );
    const heapProfilePath = process.env.PERF_HEAP_PROFILE_PATH;
    if (heapProfilePath && perfRun.durationSeconds <= 0) {
      log.error(
        `[PerfRun] PERF_HEAP_PROFILE_PATH requires a fixed capture duration`
      );
      app.quit();
      return;
    }
    let heapProfiler: PerfHeapProfiler | undefined;
    if (heapProfilePath) {
      try {
        heapProfiler = new PerfHeapProfiler(heapProfilePath);
        await heapProfiler.start();
        log.info(`[PerfRun] Main-process heap sampling started`);
      } catch (error) {
        heapProfiler = undefined;
        log.error(
          `[PerfRun] Main-process heap sampling failed`,
          safeErrorDetails(error)
        );
      }
    }
    if (perfRun.durationSeconds > 0) {
      setTimeout(async () => {
        try {
          if (heapProfiler) {
            await heapProfiler.stop();
            log.info(`[PerfRun] Main-process heap profile written`);
          }
        } catch (error) {
          log.error(
            `[PerfRun] Main-process heap profile export failed`,
            safeErrorDetails(error)
          );
        } finally {
          log.info(
            `[PerfRun] Completed fixed ${perfRun.durationSeconds}s capture`
          );
          app.quit();
        }
      }, perfRun.durationSeconds * 1000);
    }

    let phaseStartSeconds = 0;
    perfRun.visibilityPhases.forEach((phase, index) => {
      const applyPhase = () => {
        for (const window of BrowserWindow.getAllWindows()) {
          if (window.isDestroyed()) continue;
          if (phase.visibility === 'hidden') window.hide();
          else window.showInactive();
        }
        log.info(
          `${PERF_VISIBILITY_LOG_PREFIX}${JSON.stringify({
            timestamp: index === 0 ? captureOrigin : new Date().toISOString(),
            runId: process.env.PERF_RUN_ID ?? 'manual',
            index,
            visibility: phase.visibility,
            durationSeconds: phase.durationSeconds,
          })}`
        );
      };
      if (index === 0) applyPhase();
      else setTimeout(applyPhase, phaseStartSeconds * 1000);
      phaseStartSeconds += phase.durationSeconds;
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

const SHUTDOWN_FLUSH_TIMEOUT_MS = 5_000;

const handleBeforeQuit = createBeforeQuitHandler({
  prepareToQuit: () => overlayManager.markQuitting(),
  shutdown: async () => {
    keybindingManager?.stopGamepad();
    disconnectLifecycleChannel?.();
    disposeRendererDataSubscriptions?.();
    incidentRuntime?.dispose();
    disposeLapHistoryRuntime?.();
    channelBus.dispose();
    // Storage writes are debounced, so drain all pending queues within the
    // coordinator deadline before the process exits.
    await Promise.all([
      flushReferenceLapsOnShutdown(),
      flushIncidentsOnShutdown(),
      flushLapHistoryOnShutdown(),
    ]);
  },
  quit: () => app.quit(),
  reportFailure: (err) => log.error('[Shutdown] Cleanup failed:', err),
  timeoutMs: SHUTDOWN_FLUSH_TIMEOUT_MS,
});

app.on('before-quit', handleBeforeQuit);
