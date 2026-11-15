/** Per-process CPU time deltas derived from Electron's cumulative CPU seconds. */

export interface ProcessCpuSample {
  pid: number;
  creationTime: number;
  cumulativeCPUUsage?: number;
}

export interface ProcessCpuDelta {
  cpuTimeMs?: number;
  cpuTimeMsPerSecond?: number;
  cpuSampleIntervalMs?: number;
}

interface CpuBaseline {
  creationTime: number;
  cumulativeCPUUsage?: number;
  observedAtMs: number;
}

/**
 * Tracks each PID independently. New, reset, or incomplete samples establish
 * a baseline and deliberately produce no zero-valued CPU measurement.
 */
export class ProcessCpuTimeTracker {
  private baselines = new Map<number, CpuBaseline>();

  observe(
    samples: readonly ProcessCpuSample[],
    observedAtMs: number
  ): Map<number, ProcessCpuDelta> {
    const currentPids = new Set<number>();
    const deltas = new Map<number, ProcessCpuDelta>();

    for (const sample of samples) {
      currentPids.add(sample.pid);
      const previous = this.baselines.get(sample.pid);
      const cumulative = sample.cumulativeCPUUsage;
      const intervalMs = previous ? observedAtMs - previous.observedAtMs : 0;
      const validCumulative =
        typeof cumulative === 'number' &&
        Number.isFinite(cumulative) &&
        cumulative >= 0;
      const previousCumulative = previous?.cumulativeCPUUsage;
      if (
        previous !== undefined &&
        previous.creationTime === sample.creationTime &&
        validCumulative &&
        previousCumulative !== undefined &&
        cumulative >= previousCumulative &&
        Number.isFinite(intervalMs) &&
        intervalMs > 0
      ) {
        const cpuTimeMs = (cumulative - previousCumulative) * 1000;
        deltas.set(sample.pid, {
          cpuTimeMs,
          cpuTimeMsPerSecond: (cpuTimeMs / intervalMs) * 1000,
          cpuSampleIntervalMs: intervalMs,
        });
      } else {
        deltas.set(sample.pid, {});
      }

      this.baselines.set(sample.pid, {
        creationTime: sample.creationTime,
        cumulativeCPUUsage: validCumulative ? cumulative : undefined,
        observedAtMs,
      });
    }

    for (const pid of this.baselines.keys()) {
      if (!currentPids.has(pid)) this.baselines.delete(pid);
    }

    return deltas;
  }

  reset(): void {
    this.baselines.clear();
  }
}
