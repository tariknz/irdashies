import { createIbtInspectorScenarioStore } from '../storage/ibtInspectorScenario';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import type { OverlayManager } from '../overlayManager';
import type { ChannelBus } from '../bridge/channelBridge';
import {
  getCurrentBridge,
  reconfigureTelemetrySource,
} from '../bridge/iracingSdk/setup';
import { getCurrentProfileId, getDashboard } from '../storage/dashboards';
import { onDashboardUpdated } from '../storage/dashboardEvents';
import { isTapeReplayCommand } from '../bridge/tapeReplayBridge';
import logger from '../logger';
import { IbtInspectorService } from './service';
import { RendererHeapSampler } from './rendererHeapSampler';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

export function setupIbtInspector(manager: OverlayManager, bus: ChannelBus) {
  let window: BrowserWindow | undefined;
  let closing = false;
  let previous: Record<string, string | undefined> | undefined;
  const keys = [
    'IRDASHIES_TELEMETRY_REPLAY',
    'IRDASHIES_TELEMETRY_REPLAY_SPEED',
    'IRDASHIES_TELEMETRY_REPLAY_EVERY_FRAME',
    'IRDASHIES_TELEMETRY_REPLAY_PAUSED',
    'IRDASHIES_TELEMETRY_REPLAY_LOOP',
    'PERF_METRICS',
    'PERF_METRICS_COLLECTION',
    'PERF_REPORT_INTERVAL_MS',
    'PERF_SCENARIO',
    'PERF_RUN_ID',
    'PERF_SOURCE_KIND',
  ];
  const enabled = () =>
    !closing &&
    getDashboard(getCurrentProfileId())?.generalSettings?.devTool === true;
  const scenarioStore = createIbtInspectorScenarioStore(
    path.join(app.getPath('userData'), 'ibt-inspector')
  );
  const service = new IbtInspectorService({
    getProfileId: getCurrentProfileId,
    saveScenario: scenarioStore.save,
    directory: path.join(app.getPath('documents'), 'iRacing', 'telemetry'),
    workDirectory: path.join(app.getPath('userData'), 'ibt-inspector'),
    enabled,
    getWidgetTypes: () =>
      (getDashboard(getCurrentProfileId())?.widgets ?? [])
        .filter((widget) => widget.enabled)
        .map((widget) => widget.type || widget.id),
    getPlayback: () => getCurrentBridge()?.getTapeReplayStatus?.() ?? null,
    command: (command) => {
      const bridge = getCurrentBridge();
      if (!bridge?.controlTapeReplay) throw new Error('Replay is not active');
      bridge.controlTapeReplay(command);
    },
    getProcessMemorySnapshot: () =>
      app.getAppMetrics().map((metric) => ({
        key: `${metric.pid}:${metric.creationTime}`,
        pid: metric.pid,
        creationTime: metric.creationTime,
        type: metric.type,
        name: metric.name || undefined,
        cpuPercent: null,
        cpuTimeMsPerSecond: null,
        memoryMB: metric.memory.workingSetSize / 1024,
        privateMemoryMB:
          typeof metric.memory.privateBytes === 'number'
            ? metric.memory.privateBytes / 1024
            : null,
      })),
    rendererHeapSampler: new RendererHeapSampler(() =>
      BrowserWindow.getAllWindows()
    ),
    switchSource: async (tape, speed) => {
      if (!tape && !previous) return;
      if (closing && !tape) {
        getCurrentBridge()?.stop();
        if (previous)
          for (const key of keys) {
            const value = previous[key];
            if (value === undefined) Reflect.deleteProperty(process.env, key);
            else process.env[key] = value;
          }
        previous = undefined;
        return;
      }
      await reconfigureTelemetrySource(manager, bus, () => {
        if (tape) {
          previous ??= Object.fromEntries(
            keys.map((key) => [key, process.env[key]])
          );
          process.env.IRDASHIES_TELEMETRY_REPLAY = tape;
          process.env.IRDASHIES_TELEMETRY_REPLAY_SPEED = String(speed ?? 1);
          process.env.IRDASHIES_TELEMETRY_REPLAY_EVERY_FRAME = '1';
          process.env.IRDASHIES_TELEMETRY_REPLAY_PAUSED = '1';
          process.env.IRDASHIES_TELEMETRY_REPLAY_LOOP = '0';
          process.env.PERF_METRICS = '1';
          process.env.PERF_METRICS_COLLECTION = 'on';
          process.env.PERF_REPORT_INTERVAL_MS = '1000';
          process.env.PERF_SCENARIO = 'ibt-inspector';
          process.env.PERF_RUN_ID = `ibt-${Date.now()}`;
        } else if (previous) {
          for (const key of keys) {
            const value = previous[key];
            if (value === undefined) Reflect.deleteProperty(process.env, key);
            else process.env[key] = value;
          }
          previous = undefined;
        }
      });
    },
  });
  const open = () => {
    if (!enabled()) throw new Error('Enable Dev Tool in General settings');
    void service
      .restoreLastCapture()
      .catch((error) =>
        logger.warn('[IBT Inspector] Could not restore previous capture', error)
      );
    if (window && !window.isDestroyed()) {
      window.show();
      window.focus();
      return;
    }
    window = new BrowserWindow({
      title: 'irDashies - IBT Inspector',
      width: 820,
      height: 720,
      minWidth: 620,
      minHeight: 520,
      backgroundColor: '#0f172a',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const created = window;
    created.on('closed', () => {
      if (window === created) window = undefined;
    });
    created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    created.webContents.on('will-navigate', (event) => event.preventDefault());
    created.webContents.on('will-redirect', (event) => event.preventDefault());
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL)
      void created.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/ibt-inspector`);
    else
      void created.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: '/ibt-inspector' }
      );
  };
  ipcMain.handle('ibtInspector:getScenario', async () => {
    if (!enabled()) throw new Error('Enable Dev Tool in General settings');
    const scenario = await scenarioStore.read();
    if (scenario && scenario.profileId !== getCurrentProfileId())
      throw new Error(
        'Saved scenario belongs to another dashboard profile. Switch to that profile first.'
      );
    return scenario;
  });
  ipcMain.handle('ibtInspector:saveScenario', () => service.saveScenario());
  ipcMain.handle('ibtInspector:open', () => open());
  ipcMain.handle('ibtInspector:list', () => service.list());
  ipcMain.handle('ibtInspector:status', () => service.status());
  ipcMain.handle('ibtInspector:load', (_event, name: unknown, speed: unknown) =>
    service.load(name, speed)
  );
  ipcMain.handle('ibtInspector:command', (_event, command: unknown) => {
    if (!isTapeReplayCommand(command))
      throw new Error('Invalid replay command');
    return service.command(command);
  });
  ipcMain.handle('ibtInspector:stop', () => service.stop());
  ipcMain.handle('ibtInspector:startCapture', () => service.startCapture());
  ipcMain.handle('ibtInspector:stopCapture', () => service.stopCapture());
  ipcMain.handle('ibtInspector:memoryCheckpoint', () =>
    service.checkpointMemory()
  );
  ipcMain.handle('ibtInspector:showReport', () => {
    const report = service.status().capture.reportPath;
    if (report) shell.showItemInFolder(report);
  });
  let wasEnabled = false;
  const reconcile = () => {
    const active = enabled();
    if (active === wasEnabled) return;
    wasEnabled = active;
    if (active) open();
    else {
      window?.close();
      void service
        .stop()
        .catch((error) =>
          logger.error('[IBT Inspector] Could not stop replay', error)
        );
    }
  };
  const off = onDashboardUpdated(reconcile);
  reconcile();
  return async () => {
    off();
    closing = true;
    window?.destroy();
    await service.stop();
  };
}
