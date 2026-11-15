import { describe, expect, it } from 'vitest';
import { ProcessCpuTimeTracker } from './processCpuTime';

describe('ProcessCpuTimeTracker', () => {
  it('reports CPU time per PID over that PID observation interval', () => {
    const tracker = new ProcessCpuTimeTracker();

    expect(
      tracker.observe(
        [{ pid: 10, creationTime: 100, cumulativeCPUUsage: 2 }],
        1000
      ).get(10)
    ).toEqual({});
    expect(
      tracker.observe(
        [{ pid: 10, creationTime: 100, cumulativeCPUUsage: 2.25 }],
        2500
      ).get(10)
    ).toEqual({
      cpuTimeMs: 250,
      cpuTimeMsPerSecond: 1000 / 6,
      cpuSampleIntervalMs: 1500,
    });
  });

  it('leaves first, missing, reset, and reused PID samples unavailable', () => {
    const tracker = new ProcessCpuTimeTracker();
    const sample = (cumulativeCPUUsage: number, creationTime = 100) =>
      ({ pid: 10, creationTime, cumulativeCPUUsage }) as const;

    expect(tracker.observe([sample(3)], 1000).get(10)).toEqual({});
    expect(tracker.observe([sample(2)], 2000).get(10)).toEqual({});
    expect(tracker.observe([sample(2.5)], 3000).get(10)).toEqual({
      cpuTimeMs: 500,
      cpuTimeMsPerSecond: 500,
      cpuSampleIntervalMs: 1000,
    });
    expect(tracker.observe([sample(0.1, 200)], 4000).get(10)).toEqual({});
  });

  it('clears baselines for disappeared PIDs', () => {
    const tracker = new ProcessCpuTimeTracker();
    tracker.observe([{ pid: 10, creationTime: 100, cumulativeCPUUsage: 1 }], 0);
    tracker.observe([], 1000);

    expect(
      tracker.observe(
        [{ pid: 10, creationTime: 100, cumulativeCPUUsage: 2 }],
        2000
      ).get(10)
    ).toEqual({});
  });

  it('requires a new valid baseline after an unavailable cumulative value', () => {
    const tracker = new ProcessCpuTimeTracker();
    tracker.observe([{ pid: 10, creationTime: 100, cumulativeCPUUsage: 1 }], 0);
    expect(
      tracker.observe([{ pid: 10, creationTime: 100 }], 1000).get(10)
    ).toEqual({});
    expect(
      tracker.observe(
        [{ pid: 10, creationTime: 100, cumulativeCPUUsage: 4 }],
        2000
      ).get(10)
    ).toEqual({});
  });
});
