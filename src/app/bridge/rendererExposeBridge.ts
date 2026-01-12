import { contextBridge, ipcRenderer } from 'electron';
import type {
  Session,
  Telemetry,
  IrSdkBridge,
  DashboardBridge,
  DashboardLayout,
  SaveDashboardOptions,
} from '@irdashies/types';

export function exposeBridge() {
  contextBridge.exposeInMainWorld('irsdkBridge', {
    onTelemetry: (callback: (value: Telemetry) => void) =>
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
      ipcRenderer.on('demoModeChanged', (_, value) => {
        callback(value);
      });
    },
    saveGarageCoverImage: (buffer: Uint8Array) => {
      return ipcRenderer.invoke('saveGarageCoverImage', Array.from(buffer));
    },
    getGarageCoverImageAsDataUrl: (imagePath: string) => {
      return ipcRenderer.invoke('getGarageCoverImageAsDataUrl', imagePath);
    },
    getAnalyticsOptOut: () => {
      return ipcRenderer.invoke('getAnalyticsOptOut');
    },
    setAnalyticsOptOut: (optOut: boolean) => {
      return ipcRenderer.invoke('setAnalyticsOptOut', optOut);
    },
    stop: () => {
      ipcRenderer.removeAllListeners('editModeToggled');
      ipcRenderer.removeAllListeners('dashboardUpdated');
      ipcRenderer.removeAllListeners('demoModeChanged');
    },
  } as DashboardBridge);
}
