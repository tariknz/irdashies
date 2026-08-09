import type { RendererPerfMeasureName } from '@irdashies/types';

export const perfMetrics = {
  measure<T>(name: RendererPerfMeasureName, measured: () => T): T {
    const bridge = window.rendererPerfBridge;
    if (!bridge) return measured();

    const startedAt = performance.now();
    try {
      return measured();
    } finally {
      bridge.recordMeasure(name, performance.now() - startedAt);
    }
  },
};
