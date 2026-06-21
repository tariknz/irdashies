import { contextBridge, ipcRenderer } from 'electron';
import type {
  LogBridge,
  LogLevel,
  PitLaneBridge,
  PitLaneTrackData,
} from '@irdashies/types';

export function exposeInMainWorld() {
  const logBridge: LogBridge = {
    log: (level: LogLevel, ...args: unknown[]) =>
      ipcRenderer.send('log', level, ...args),
  };

  contextBridge.exposeInMainWorld('logBridge', logBridge);

  contextBridge.exposeInMainWorld('globalKey', {
    onToggle: (cb: (hide: boolean) => void) => {
      const listener = (_: Electron.IpcRendererEvent, hide: boolean) =>
        cb(hide);
      ipcRenderer.on('global-toggle-hide', listener);
      return () => ipcRenderer.removeListener('global-toggle-hide', listener);
    },
    onWidgetToggle: (cb: (widgetId: string, hide: boolean) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        widgetId: string,
        hide: boolean
      ) => cb(widgetId, hide);
      ipcRenderer.on('widget-toggle-hide', listener);
      return () => ipcRenderer.removeListener('widget-toggle-hide', listener);
    },
  });

  contextBridge.exposeInMainWorld('profileSwitch', {
    onTransition: (
      cb: (data: {
        hidden: boolean;
        name: string;
        showBanner?: boolean;
      }) => void
    ) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: { hidden: boolean; name: string; showBanner?: boolean }
      ) => cb(data);
      ipcRenderer.on('profileTransition', listener);
      return () => ipcRenderer.removeListener('profileTransition', listener);
    },
  });

  const pitLaneBridge: PitLaneBridge = {
    getPitLaneData: (trackId: string) =>
      ipcRenderer.invoke('pitLane:getData', trackId),
    updatePitLaneData: (trackId: string, data: Partial<PitLaneTrackData>) =>
      ipcRenderer.invoke('pitLane:updateData', trackId, data),
  };

  contextBridge.exposeInMainWorld('pitLaneBridge', pitLaneBridge);
}
