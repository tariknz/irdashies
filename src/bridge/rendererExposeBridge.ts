import { contextBridge, ipcRenderer } from 'electron';
import type { Session, Telemetry } from '@irdashies/types';
import type { IrSdkBridge } from './iracingSdk/irSdkBridge.type';
import { DashboardLayout } from '../app/storage/dashboards';
import { DashboardBridge } from './dashboard/dashboardBridge.type';

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
  } as DashboardBridge);
}
