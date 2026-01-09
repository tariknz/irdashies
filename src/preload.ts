// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { exposeBridge } from './app/bridge/rendererExposeBridge';
import { exposeInMainWorld } from './app/rendererExpose';

exposeBridge();
exposeInMainWorld();