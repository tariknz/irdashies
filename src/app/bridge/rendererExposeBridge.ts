import { contextBridge, ipcRenderer } from 'electron';
import type {
  Session,
  Telemetry,
  IrSdkBridge,
  DashboardBridge,
  DashboardLayout,
  DashboardProfile,
  SaveDashboardOptions,
  ContainerBoundsInfo,
  FuelCalculatorBridge,
  FuelLapData,
  KeybindingsBridge,
  KeybindingActionId,
  GamepadHostBridge,
  PersonalBestLapBridge,
  ChromiumFlagsBridge,
  ChromiumFlagsType,
  TelemetryInspectorBridge,
  RendererPerfBridge,
} from '@irdashies/types';
import {
  isRendererPerfMetricsEnabled,
  recordTelemetryCallback,
  recordRendererMeasure,
} from '../rendererPerfMetrics';
import {
  RENDERER_DATA_SUBSCRIPTION_BRIDGE,
  type RendererDataStream,
} from './rendererDataSubscriptions';
import { createSubscriptionBridgeClient, defineBridge } from './defineBridge';

export function exposeBridge() {
  if (isRendererPerfMetricsEnabled()) {
    defineBridge<RendererPerfBridge>('rendererPerfBridge', {
      recordMeasure: (name, durationMs) => {
        if (!isRendererPerfMetricsEnabled()) return;
        if (name !== 'trackMapAnimationFrame') return;
        if (!Number.isFinite(durationMs) || durationMs < 0) return;
        recordRendererMeasure(name, durationMs);
      },
    });
  }
  const rendererDataSubscriptions =
    createSubscriptionBridgeClient<RendererDataStream>(
      RENDERER_DATA_SUBSCRIPTION_BRIDGE
    );
  const rendererDataListenerCounts = new Map<RendererDataStream, number>();
  const addRendererDataListener = (stream: RendererDataStream) => {
    const count = rendererDataListenerCounts.get(stream) ?? 0;
    rendererDataListenerCounts.set(stream, count + 1);
    if (count === 0) void rendererDataSubscriptions.subscribe(stream);
  };
  const removeRendererDataListener = (stream: RendererDataStream) => {
    const count = rendererDataListenerCounts.get(stream) ?? 0;
    if (count <= 1) {
      rendererDataListenerCounts.delete(stream);
      void rendererDataSubscriptions.unsubscribe(stream);
      return;
    }
    rendererDataListenerCounts.set(stream, count - 1);
  };
  defineBridge<IrSdkBridge>('irsdkBridge', {
    onSessionData: (callback: (value: Session) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: Session) => {
        callback(value);
      };
      addRendererDataListener('sessionData');
      ipcRenderer.on('sessionData', handler);
      return () => {
        ipcRenderer.removeListener('sessionData', handler);
        removeRendererDataListener('sessionData');
      };
    },
    onRunningState: (callback: (value: boolean) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: boolean) => {
        callback(value);
      };
      ipcRenderer.on('runningState', handler);
      return () => ipcRenderer.removeListener('runningState', handler);
    },
    stop: () => {
      for (const stream of rendererDataListenerCounts.keys()) {
        void rendererDataSubscriptions.unsubscribe(stream);
      }
      rendererDataListenerCounts.clear();
      ipcRenderer.removeAllListeners('sessionData');
      ipcRenderer.removeAllListeners('runningState');
      ipcRenderer.removeAllListeners('telemetryInspector:telemetry');
    },
  });
  defineBridge<TelemetryInspectorBridge>('telemetryInspectorBridge', {
    onTelemetry: (callback: (value: Telemetry) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: Telemetry) => {
        if (!isRendererPerfMetricsEnabled()) {
          callback(value);
          return;
        }
        const start = performance.now();
        callback(value);
        recordTelemetryCallback(performance.now() - start);
      };
      addRendererDataListener('telemetryInspector');
      ipcRenderer.on('telemetryInspector:telemetry', handler);
      return () => {
        ipcRenderer.removeListener('telemetryInspector:telemetry', handler);
        removeRendererDataListener('telemetryInspector');
      };
    },
    onSessionData: (callback: (value: Session) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: Session) => {
        callback(value);
      };
      addRendererDataListener('sessionData');
      ipcRenderer.on('sessionData', handler);
      return () => {
        ipcRenderer.removeListener('sessionData', handler);
        removeRendererDataListener('sessionData');
      };
    },
  });

  contextBridge.exposeInMainWorld('dashboardBridge', {
    onEditModeToggled: (callback: (value: boolean) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: boolean) => {
        callback(value);
      };
      ipcRenderer.on('editModeToggled', handler);
      return () => ipcRenderer.removeListener('editModeToggled', handler);
    },
    reloadDashboard: () => {
      ipcRenderer.send('reloadDashboard');
    },
    dashboardUpdated: (
      callback: (dashboard: DashboardLayout, profileId?: string) => void
    ) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        dashboard: DashboardLayout,
        profileId?: string
      ) => {
        callback(dashboard, profileId);
      };
      ipcRenderer.on('dashboardUpdated', handler);
      return () => ipcRenderer.removeListener('dashboardUpdated', handler);
    },
    saveDashboard: (value: DashboardLayout, options?: SaveDashboardOptions) => {
      ipcRenderer.send('saveDashboard', value, options);
    },
    resetDashboard: (resetEverything: boolean) => {
      return ipcRenderer.invoke('resetDashboard', resetEverything);
    },
    toggleLockOverlays: () => {
      return ipcRenderer.invoke('toggleLockOverlays');
    },
    getAppVersion: () => {
      return ipcRenderer.invoke('getAppVersion');
    },
    toggleDemoMode: (value: boolean) => {
      ipcRenderer.send('toggleDemoMode', value);
    },
    onDemoModeChanged: (callback: (value: boolean) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: boolean) => {
        callback(value);
      };
      ipcRenderer.on('demoModeChanged', handler);
      return () => ipcRenderer.removeListener('demoModeChanged', handler);
    },
    saveGarageCoverImage: (buffer: Uint8Array) => {
      return ipcRenderer.invoke('saveGarageCoverImage', Array.from(buffer));
    },
    getGarageCoverImageAsDataUrl: (imagePath: string) => {
      return ipcRenderer.invoke('getGarageCoverImageAsDataUrl', imagePath);
    },
    savePlayerIconImage: (buffer: Uint8Array) => {
      return ipcRenderer.invoke('savePlayerIconImage', Array.from(buffer));
    },
    getPlayerIconImageAsDataUrl: (imagePath: string) => {
      return ipcRenderer.invoke('getPlayerIconImageAsDataUrl', imagePath);
    },
    getAnalyticsOptOut: () => {
      return ipcRenderer.invoke('getAnalyticsOptOut');
    },
    setAnalyticsOptOut: (optOut: boolean) => {
      return ipcRenderer.invoke('setAnalyticsOptOut', optOut);
    },
    getCycleProfiles: () => {
      return ipcRenderer.invoke('getCycleProfiles');
    },
    setCycleProfiles: (enabled: boolean) => {
      return ipcRenderer.invoke('setCycleProfiles', enabled);
    },
    getShowProfileBanner: () => {
      return ipcRenderer.invoke('getShowProfileBanner');
    },
    setShowProfileBanner: (enabled: boolean) => {
      return ipcRenderer.invoke('setShowProfileBanner', enabled);
    },
    // Profile management
    listProfiles: () => {
      return ipcRenderer.invoke('listProfiles');
    },
    createProfile: (name: string) => {
      return ipcRenderer.invoke('createProfile', name);
    },
    cloneProfile: (profileId: string) => {
      return ipcRenderer.invoke('cloneProfile', profileId);
    },
    deleteProfile: (profileId: string) => {
      return ipcRenderer.invoke('deleteProfile', profileId);
    },
    renameProfile: (profileId: string, newName: string) => {
      return ipcRenderer.invoke('renameProfile', profileId, newName);
    },
    switchProfile: (profileId: string) => {
      return ipcRenderer.invoke('switchProfile', profileId);
    },
    getCurrentProfile: () => {
      return ipcRenderer.invoke('getCurrentProfile');
    },
    getDashboardForProfile: (profileId: string) => {
      return ipcRenderer.invoke('getDashboardForProfile', profileId);
    },
    updateProfileTheme: (
      profileId: string,
      themeSettings: DashboardProfile['themeSettings']
    ) => {
      return ipcRenderer.invoke('updateProfileTheme', profileId, themeSettings);
    },
    stop: () => {
      ipcRenderer.removeAllListeners('editModeToggled');
      ipcRenderer.removeAllListeners('dashboardUpdated');
      ipcRenderer.removeAllListeners('demoModeChanged');
      ipcRenderer.removeAllListeners('containerBoundsInfo');
    },
    setAutoStart: (enabled: boolean) => {
      return ipcRenderer.invoke('autostart:set', enabled);
    },
    getDriverTagSettings: () => {
      return ipcRenderer.invoke('getDriverTagSettings');
    },
    saveDriverTagSettings: (settings: unknown) => {
      return ipcRenderer.invoke('saveDriverTagSettings', settings);
    },
    getComponentServerPort: () => {
      return ipcRenderer.invoke('getComponentServerPort');
    },
    exportDashboardToFile: (dashboard: DashboardLayout) => {
      return ipcRenderer.invoke('exportDashboardToFile', dashboard);
    },
    importDashboardFromFile: () => {
      return ipcRenderer.invoke('importDashboardFromFile');
    },
    openLogFolder: () => {
      return ipcRenderer.invoke('openLogFolder');
    },
    exportLogFile: () => {
      return ipcRenderer.invoke('exportLogFile');
    },
    getCurrentDashboard: () => {
      // This is a synchronous getter used in overlay container mode
      // The actual dashboard state is managed by the OverlayContainer component
      return null;
    },
    onContainerBoundsInfo: (callback: (value: ContainerBoundsInfo) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        value: ContainerBoundsInfo
      ) => {
        callback(value);
      };
      ipcRenderer.on('containerBoundsInfo', handler);
      return () => ipcRenderer.removeListener('containerBoundsInfo', handler);
    },
    openWidgetSettings: (widgetType: string) => {
      return ipcRenderer.invoke('openWidgetSettings', widgetType);
    },
    onNavigateToSettings: (callback: (widgetType: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, widgetType: string) => {
        callback(widgetType);
      };
      ipcRenderer.on('navigateToSettings', handler);
      return () => ipcRenderer.removeListener('navigateToSettings', handler);
    },
  } as DashboardBridge);

  contextBridge.exposeInMainWorld('fuelCalculatorBridge', {
    getHistoricalLaps: (trackId: number, carName: string) => {
      return ipcRenderer.invoke('fuel:getHistoricalLaps', trackId, carName);
    },
    saveLap: (trackId: number, carName: string, lap: FuelLapData) => {
      return ipcRenderer.invoke('fuel:saveLap', trackId, carName, lap);
    },
    clearHistory: (trackId: number, carName: string) => {
      return ipcRenderer.invoke('fuel:clearHistory', trackId, carName);
    },
    clearAllHistory: () => {
      return ipcRenderer.invoke('fuel:clearAllHistory');
    },
    getQualifyMax: (trackId: number, carName: string) => {
      return ipcRenderer.invoke('fuel:getQualifyMax', trackId, carName);
    },
    saveQualifyMax: (trackId: number, carName: string, val: number | null) => {
      return ipcRenderer.invoke('fuel:saveQualifyMax', trackId, carName, val);
    },
    startNewLog: () => ipcRenderer.invoke('fuel:startNewLog'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logData: (data: any) => {
      return ipcRenderer.invoke('fuel:logData', data);
    },
  } as FuelCalculatorBridge);

  contextBridge.exposeInMainWorld('keybindingsBridge', {
    getKeybindings: () => ipcRenderer.invoke('keybindings:get'),
    updateKeybinding: (
      actionId: KeybindingActionId,
      accelerator: string,
      meta?: { label: string; description: string }
    ) => ipcRenderer.invoke('keybindings:update', actionId, accelerator, meta),
    resetKeybinding: (actionId: KeybindingActionId) =>
      ipcRenderer.invoke('keybindings:reset', actionId),
    resetAllKeybindings: () => ipcRenderer.invoke('keybindings:resetAll'),
    startRecording: () => ipcRenderer.invoke('keybindings:startRecording'),
    stopRecording: () => ipcRenderer.invoke('keybindings:stopRecording'),
    onGamepadCaptured: (callback: (token: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, token: string) =>
        callback(token);
      ipcRenderer.on('keybindings:gamepadCaptured', handler);
      return () =>
        ipcRenderer.removeListener('keybindings:gamepadCaptured', handler);
    },
  } as KeybindingsBridge);

  // Used only by the hidden WebHID host renderer (src/hidHost.ts) to forward
  // controller button presses to the main process.
  contextBridge.exposeInMainWorld('gamepadHost', {
    sendButton: (token: string, down: boolean) =>
      ipcRenderer.send('gamepad:button', token, down),
  } satisfies GamepadHostBridge);

  contextBridge.exposeInMainWorld('personalBestBridge', {
    getPersonalBest: (trackId: string | number, carName: string) =>
      ipcRenderer.invoke('personalBest:get', trackId, carName),
    setPersonalBest: (
      trackId: string | number,
      carName: string,
      time: number
    ) => ipcRenderer.invoke('personalBest:set', trackId, carName, time),
  } as PersonalBestLapBridge);

  contextBridge.exposeInMainWorld('chromiumFlagsBridge', {
    getFlags: () => ipcRenderer.invoke('chromiumFlags:get'),
    saveFlags: (flags: ChromiumFlagsType) =>
      ipcRenderer.invoke('chromiumFlags:save', flags),
  } as ChromiumFlagsBridge);
}
