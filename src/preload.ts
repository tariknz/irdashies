// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { exposeBridge } from './app/bridge/rendererExposeBridge';
import { exposeInMainWorld } from './app/rendererExpose';
import { startRendererPerfMetrics } from './app/rendererPerfMetrics';
import { exposeChannelBridge } from './app/bridge/channelRendererBridge';

startRendererPerfMetrics();
exposeBridge();
exposeInMainWorld();
exposeChannelBridge();

// Local-only feature bridges (git-excluded src/local/). Empty glob => no-op.
// The negative pattern keeps co-located *.spec.ts test files out of the bundle.
const localPreloadModules = import.meta.glob(
  ['./local/preload/*.ts', '!./local/preload/*.spec.ts'],
  { eager: true }
) as Record<string, { expose?: () => void }>;
for (const mod of Object.values(localPreloadModules)) {
  mod.expose?.();
}
