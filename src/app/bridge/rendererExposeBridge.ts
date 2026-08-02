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
  ReferenceLap,
  ReferenceLapBridge,
  KeybindingsBridge,
  KeybindingActionId,
  GamepadHostBridge,
  PersonalBestLapBridge,
  ChromiumFlagsBridge,
  ChromiumFlagsType,
  RaceControlBridge,
  Incident,
  IncidentThresholds,
  SessionRetention,
} from '@irdashies/types';
import {
  isRendererPerfMetricsEnabled,
  recordTelemetryCallback,
} from '../rendererPerfMetrics';
import {
  LEGACY_STREAM_BRIDGE,
  type LegacyRendererStream,
} from './legacyRendererSubscriptions';
import { createSubscriptionBridgeClient, defineBridge } from './defineBridge';

export function exposeBridge() {
  const legacySubscriptions =
    createSubscriptionBridgeClient<LegacyRendererStream>(LEGACY_STREAM_BRIDGE);
  const legacyListenerCounts = new Map<LegacyRendererStream, number>();
  const addLegacyListener = (stream: LegacyRendererStream) => {
    const count = legacyListenerCounts.get(stream) ?? 0;
    legacyListenerCounts.set(stream, count + 1);
    if (count === 0) void legacySubscriptions.subscribe(stream);
  };
  const removeLegacyListener = (stream: LegacyRendererStream) => {
    const count = legacyListenerCounts.get(stream) ?? 0;
    if (count <= 1) {
      legacyListenerCounts.delete(stream);
      void legacySubscriptions.unsubscribe(stream);
      return;
    }
    legacyListenerCounts.set(stream, count - 1);
  };
  defineBridge<IrSdkBridge>('irsdkBridge', {
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
      addLegacyListener('telemetry');
      ipcRenderer.on('telemetry', handler);
      return () => {
        ipcRenderer.removeListener('telemetry', handler);
        removeLegacyListener('telemetry');
      };
    },
    onSessionData: (callback: (value: Session) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: Session) => {
        callback(value);
      };
      addLegacyListener('sessionData');
      ipcRenderer.on('sessionData', handler);
      return () => {
        ipcRenderer.removeListener('sessionData', handler);
        removeLegacyListener('sessionData');
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
      for (const stream of legacyListenerCounts.keys()) {
        void legacySubscriptions.unsubscribe(stream);
      }
      legacyListenerCounts.clear();
      ipcRenderer.removeAllListeners('telemetry');
      ipcRenderer.removeAllListeners('sessionData');
      ipcRenderer.removeAllListeners('runningState');
    },
    // Broadcast commands are main-process only; the renderer drives them
    // through raceControlBridge below, not through this bridge.
    /* eslint-disable @typescript-eslint/no-empty-function */
    changeCameraNumber: () => {},
    changeReplayPosition: () => {},
    triggerReplaySessionSearch: () => {},
    /* eslint-enable @typescript-eslint/no-empty-function */
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

  contextBridge.exposeInMainWorld('referenceLapsBridge', {
    getReferenceLap: (seriesId: number, trackId: number, classId: number) => {
      return ipcRenderer.invoke('reference:get', seriesId, trackId, classId);
    },
    saveReferenceLap: (
      seriesId: number,
      trackId: number,
      classId: number,
      lap: ReferenceLap
    ) => {
      return ipcRenderer.invoke(
        'reference:save',
        seriesId,
        trackId,
        classId,
        lap
      );
    },
  } as ReferenceLapBridge);

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

  contextBridge.exposeInMainWorld('raceControlBridge', {
    getIncidents: () => ipcRenderer.invoke('raceControl:getIncidents'),
    onIncident: (cb: (incident: Incident) => void) => {
      const handler = (_: Electron.IpcRendererEvent, incident: Incident) =>
        cb(incident);
      ipcRenderer.on('raceControl:incident', handler);
      return () => ipcRenderer.removeListener('raceControl:incident', handler);
    },
    replayIncident: (incident: Incident, seconds: number) =>
      ipcRenderer.invoke('raceControl:replayIncident', incident, seconds),
    clearIncidents: () => ipcRenderer.invoke('raceControl:clearIncidents'),
    updateThresholds: (thresholds: IncidentThresholds) =>
      ipcRenderer.invoke('raceControl:updateThresholds', thresholds),
    updateRetention: (retention: SessionRetention) =>
      ipcRenderer.invoke('raceControl:updateRetention', retention),
    showGantryWindow: () => ipcRenderer.invoke('raceControl:showGantryWindow'),
  } as RaceControlBridge);
}
