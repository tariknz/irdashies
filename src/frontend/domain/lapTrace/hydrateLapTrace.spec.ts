import { describe, it, expect } from 'vitest';
import {
  LAP_TRACE_SCHEMA_VERSION,
  type LapTraceRecord,
} from '@irdashies/types';
import { hydrateLapTrace } from './hydrateLapTrace';
import { makeSyntheticLapTrace } from '../../components/LapTrace/fixtures/syntheticLap';

/** Samples 1 m apart with the given speed and gear traces. */
const makeRecord = (
  speed: number[],
  gear: number[],
  pedals: { throttle?: number[]; brake?: number[] } = {}
): LapTraceRecord => {
  const n = speed.length;
  return {
    schemaVersion: LAP_TRACE_SCHEMA_VERSION,
    source: { kind: 'best', label: 'Personal Best', importedAt: 0 },
    trackId: 1,
    trackConfigName: '',
    carPath: 'car',
    trackLengthM: Math.max(n, 1) * 5,
    lapTimeSec: 90,
    samples: {
      length: n,
      distanceM: Float32Array.from({ length: n }, (_, i) => i),
      timeSec: Float32Array.from({ length: n }, (_, i) => i * 0.02),
      throttle: Float32Array.from(pedals.throttle ?? new Array(n).fill(1)),
      brake: Float32Array.from(pedals.brake ?? new Array(n).fill(0)),
      speed: Float32Array.from(speed),
      gear: Float32Array.from(gear),
      absActive: new Float32Array(n),
    },
    recordedAt: 0,
  };
};

describe('hydrateLapTrace', () => {
  it('derives the speed range over the samples', () => {
    const view = hydrateLapTrace(makeRecord([40, 55, 30, 60], [3, 4, 2, 5]));
    expect(view.speedMinMs).toBe(30);
    expect(view.speedMaxMs).toBe(60);
  });

  it('falls back to a zero range when there are no samples', () => {
    const view = hydrateLapTrace(makeRecord([], []));
    expect(view.speedMinMs).toBe(0);
    expect(view.speedMaxMs).toBe(0);
  });

  it('emits no gear changes for a constant-gear lap', () => {
    const view = hydrateLapTrace(makeRecord([40, 41, 42, 43], [4, 4, 4, 4]));
    expect(view.gearChangeM).toHaveLength(0);
    expect(view.gearChangeValues).toHaveLength(0);
  });

  it('anchors a change to the first sample of the new gear, in metres', () => {
    const view = hydrateLapTrace(
      makeRecord([40, 41, 42, 43, 44], [2, 2, 3, 3, 3])
    );
    expect(Array.from(view.gearChangeM)).toEqual([2]);
    expect(Array.from(view.gearChangeValues)).toEqual([3]);
  });

  it('skips the neutral blip the sim reports mid-shift', () => {
    const view = hydrateLapTrace(
      makeRecord([40, 41, 42, 43, 44], [3, 3, 0, 4, 4])
    );
    expect(Array.from(view.gearChangeM)).toEqual([3]);
    expect(Array.from(view.gearChangeValues)).toEqual([4]);
  });

  it('round-trips reverse through the Int8Array', () => {
    const view = hydrateLapTrace(makeRecord([10, 10, 10], [1, -1, 1]));
    expect(Array.from(view.gearChangeValues)).toEqual([-1, 1]);
  });

  it('derives pedal application points from the samples', () => {
    const view = hydrateLapTrace(
      makeRecord([40, 40, 40, 40, 40], [3, 3, 3, 3, 3], {
        throttle: [1, 1, 0, 0, 0],
        brake: [0, 0, 0, 0.5, 1],
      })
    );
    expect(view.events.brakeOnM.length).toBe(1);
    // 0 -> 0.5 between 2 m and 3 m: the 0.01 threshold is 2% of the way in.
    expect(view.events.brakeOnM[0]).toBeCloseTo(2.02, 4);
    // Starting on the throttle is not an application.
    expect(view.events.throttleOnM.length).toBe(0);
  });

  it('keeps a gear-change artefact out of the marker list without losing it', () => {
    // Braking in 4th with a rev-matching blip, then 3rd. The application is
    // real and stays in events; it is just not somewhere to draw a marker.
    const n = 60;
    const throttle = new Array(n).fill(0);
    const gear = new Array(n).fill(4);
    for (let i = 20; i < 28; i++) throttle[i] = 0.4;
    gear[28] = 0;
    for (let i = 29; i < n; i++) gear[i] = 3;

    const view = hydrateLapTrace(
      makeRecord(new Array(n).fill(40), gear, { throttle })
    );

    expect(view.events.throttleOnM).toHaveLength(1);
    expect(view.throttlePointsM).toHaveLength(0);
  });

  it('marks a throttle application that no shift explains', () => {
    const n = 60;
    const throttle = new Array(n).fill(0);
    for (let i = 20; i < n; i++) throttle[i] = 1;

    const view = hydrateLapTrace(
      makeRecord(new Array(n).fill(40), new Array(n).fill(3), { throttle })
    );

    expect(view.throttlePointsM).toHaveLength(1);
    expect(view.throttlePointsM[0]).toBeCloseTo(view.events.throttleOnM[0], 4);
  });

  it('finds shift points in a full synthetic lap', () => {
    const view = hydrateLapTrace(makeSyntheticLapTrace());
    expect(view.gearChangeM.length).toBeGreaterThan(4);
    expect(view.gearChangeM.length).toBe(view.gearChangeValues.length);
    expect(view.speedMaxMs).toBeGreaterThan(view.speedMinMs);
    // Change positions must be ascending — the renderer scans them in order.
    for (let i = 1; i < view.gearChangeM.length; i++) {
      expect(view.gearChangeM[i]).toBeGreaterThan(view.gearChangeM[i - 1]);
    }
    // Seven corners, seven braking zones.
    expect(view.events.brakeOnM.length).toBe(7);
  });
});
