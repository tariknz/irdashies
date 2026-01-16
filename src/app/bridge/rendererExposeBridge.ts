import { contextBridge, ipcRenderer } from 'electron';
import type {
  Session,
  Telemetry,
  IrSdkBridge,
  DashboardBridge,
  DashboardLayout,
  DashboardProfile,
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
    // Profile management
    listProfiles: () => {
      return ipcRenderer.invoke('listProfiles');
    },
    createProfile: (name: string) => {
      return ipcRenderer.invoke('createProfile', name);
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
    updateProfileTheme: (profileId: string, themeSettings: DashboardProfile['themeSettings']) => {
      return ipcRenderer.invoke('updateProfileTheme', profileId, themeSettings);
    },
    stop: () => {
      ipcRenderer.removeAllListeners('editModeToggled');
      ipcRenderer.removeAllListeners('dashboardUpdated');
      ipcRenderer.removeAllListeners('demoModeChanged');
    },

    setAutoStart: (enabled: boolean) => {
      ipcRenderer.invoke('autostart:set', enabled);
    },

  } as DashboardBridge);
}
