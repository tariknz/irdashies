import { contextBridge, ipcRenderer } from 'electron';
import type {
  Session,
  Telemetry,
  IrSdkBridge,
  DashboardBridge,
  DashboardLayout,
  SaveDashboardOptions,
  ContainerBoundsInfo,
} from '@irdashies/types';

export function exposeBridge() {
  contextBridge.exposeInMainWorld('irsdkBridge', {
    onTelemetry: (callback: (value: Telemetry) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: Telemetry) => {
        callback(value);
      };
      ipcRenderer.on('telemetry', handler);
      return () => ipcRenderer.removeListener('telemetry', handler);
    },
    onSessionData: (callback: (value: Session) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: Session) => {
        callback(value);
      };
      ipcRenderer.on('sessionData', handler);
      return () => ipcRenderer.removeListener('sessionData', handler);
    },
    onRunningState: (callback: (value: boolean) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: boolean) => {
        callback(value);
      };
      ipcRenderer.on('runningState', handler);
      return () => ipcRenderer.removeListener('runningState', handler);
    },
    stop: () => {
      ipcRenderer.removeAllListeners('telemetry');
      ipcRenderer.removeAllListeners('sessionData');
      ipcRenderer.removeAllListeners('runningState');
    },
  } as IrSdkBridge);

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
    dashboardUpdated: (callback: (value: DashboardLayout) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: DashboardLayout) => {
        callback(value);
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
      ipcRenderer.removeAllListeners('containerBoundsInfo');
    },
    setAutoStart: (enabled: boolean) => {
      return ipcRenderer.invoke('autostart:set', enabled);
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
  } as DashboardBridge);
}
