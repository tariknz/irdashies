import type { RendererPerfMeasureName } from '@irdashies/types';

export const perfMetrics = {
  measure<T>(
    name: RendererPerfMeasureName,
    measured: () => T,
    breakdownName?: RendererPerfMeasureName
  ): T {
    const bridge = window.rendererPerfBridge;
    if (!bridge) return measured();

    const startedAt = performance.now();
    try {
      return measured();
    } finally {
      const durationMs = performance.now() - startedAt;
      bridge.recordMeasure(name, durationMs);
      if (breakdownName) bridge.recordMeasure(breakdownName, durationMs);
    }
  },
};
