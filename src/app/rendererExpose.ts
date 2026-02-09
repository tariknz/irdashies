import { contextBridge, ipcRenderer } from 'electron';
import type { PitLaneBridge, PitLaneTrackData } from '@irdashies/types';

export function exposeInMainWorld() {
contextBridge.exposeInMainWorld('globalKey', {
  onToggle: (cb: (hide: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, hide: boolean) => cb(hide);
    ipcRenderer.on('global-toggle-hide', listener);
    return () => ipcRenderer.removeListener('global-toggle-hide', listener);
  }
});

const pitLaneBridge: PitLaneBridge = {
  getPitLaneData: (trackId: string) => ipcRenderer.invoke('pitLane:getData', trackId),
  updatePitLaneData: (trackId: string, data: Partial<PitLaneTrackData>) =>
    ipcRenderer.invoke('pitLane:updateData', trackId, data),
};

contextBridge.exposeInMainWorld('pitLaneBridge', pitLaneBridge);
}