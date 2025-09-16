import { contextBridge, ipcRenderer } from 'electron';
import type {
  Session,
  Telemetry,
  IrSdkBridge,
  DashboardBridge,
  DashboardLayout,
  OverlayTelemetryPayload,
} from '@irdashies/types';

// Telemetry bridge for field subscriptions
const telemetryBridge = {
  subscribeToTelemetryFields: (fields: (keyof Telemetry)[]) =>
    ipcRenderer.invoke('subscribe-telemetry-fields', fields),
  unsubscribeFromTelemetryFields: (fields: (keyof Telemetry)[]) =>
    ipcRenderer.invoke('unsubscribe-telemetry-fields', fields),
} as const;

export function exposeBridge() {
  contextBridge.exposeInMainWorld('irsdkBridge', {
    onTelemetry: (callback: (value: OverlayTelemetryPayload) => void) =>
      ipcRenderer.on('telemetry', (_, value) => {
        callback(value);
      }),
    onSessionData: (callback: (value: Session) => void) =>
      ipcRenderer.on('sessionData', (_, value) => {
        callback(value);
      }),
    onRunningState: (callback: (value: boolean) => void) =>
      ipcRenderer.on('runningState', (_, value) => {
        callback(value);
      }),
    stop: () => {
      ipcRenderer.removeAllListeners('telemetry');
      ipcRenderer.removeAllListeners('sessionData');
      ipcRenderer.removeAllListeners('runningState');
    },
  } as IrSdkBridge);

  contextBridge.exposeInMainWorld('dashboardBridge', {
    onEditModeToggled: (callback: (value: boolean) => void) => {
      ipcRenderer.on('editModeToggled', (_, value) => {
        callback(value);
      });
    },
    reloadDashboard: () => {
      ipcRenderer.send('reloadDashboard');
    },
    dashboardUpdated: (callback: (value: DashboardLayout) => void) => {
      ipcRenderer.on('dashboardUpdated', (_, value) => {
        callback(value);
      });
    },
    saveDashboard: (value: DashboardLayout) => {
      ipcRenderer.send('saveDashboard', value);
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
  } as DashboardBridge);

  // Expose telemetry bridge for field subscriptions
  contextBridge.exposeInMainWorld('telemetryBridge', telemetryBridge);
}
