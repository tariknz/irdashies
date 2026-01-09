// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { exposeBridge } from './app/bridge/rendererExposeBridge';
import { contextBridge, ipcRenderer } from 'electron';

exposeBridge();

contextBridge.exposeInMainWorld('globalKey', {
  onToggle: (cb: (hide: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, hide: boolean) => cb(hide);
    ipcRenderer.on('global-toggle-hide', listener);
    return () => ipcRenderer.removeListener('global-toggle-hide', listener);
  }
});