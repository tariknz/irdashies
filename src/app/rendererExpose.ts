import { contextBridge, ipcRenderer } from 'electron';

export function exposeInMainWorld() {
contextBridge.exposeInMainWorld('globalKey', {
  onToggle: (cb: (hide: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, hide: boolean) => cb(hide);
    ipcRenderer.on('global-toggle-hide', listener);
    return () => ipcRenderer.removeListener('global-toggle-hide', listener);
  }
});
}