import { contextBridge, ipcRenderer } from 'electron';
import type {
  LogBridge,
  LogLevel,
  PitLaneBridge,
  PitLaneTrackData,
} from '@irdashies/types';
import { defineBridge } from './bridge/defineBridge';

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
      let active = true;
      const seen = new Set<string>();
      const listener = (
        _: Electron.IpcRendererEvent,
        widgetId: string,
        hide: boolean
      ) => {
        seen.add(widgetId);
        cb(widgetId, hide);
      };
      ipcRenderer.on('widget-toggle-hide', listener);
      // Replay widgets already hidden, so remounted overlays stay hidden.
      // Live events that beat the reply win over its stale snapshot.
      ipcRenderer
        .invoke('widgetVisibility:getHidden')
        .then((ids: string[]) =>
          ids.forEach((id) => active && !seen.has(id) && cb(id, true))
        )
        .catch(() => undefined);
      return () => {
        active = false;
        ipcRenderer.removeListener('widget-toggle-hide', listener);
      };
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
    updatePitLaneData: (
      trackId,
      data: Partial<PitLaneTrackData>,
      revision,
      sourceId
    ) =>
      ipcRenderer.invoke(
        'pitLane:updateData',
        trackId,
        data,
        revision,
        sourceId
      ),
    getCurrentTrackPitLaneInfo: () =>
      ipcRenderer.invoke('pitLane:getCurrentTrack'),
    resetPitLaneData: (trackId) =>
      ipcRenderer.invoke('pitLane:resetData', trackId),
    openPitLaneDataFile: () => ipcRenderer.invoke('pitLane:openFile'),
    reloadPitLaneDataFile: () => ipcRenderer.invoke('pitLane:reloadFile'),
  };

  defineBridge<PitLaneBridge>('pitLaneBridge', pitLaneBridge);
}
