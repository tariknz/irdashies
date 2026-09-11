import { describe, it, expect } from 'vitest';
import type { IbtImportResult } from '@irdashies/types';
import {
  IBT_IMPORT_CAR_PATH,
  IBT_IMPORT_TRACK_ID,
  ibtSamplesToLapTrace,
} from './ibtLapImport';
import { hydrateLapTrace } from './hydrateLapTrace';

const makeResult = (
  overrides: Partial<IbtImportResult> = {}
): IbtImportResult => {
  const n = 400;
  const pct = new Float32Array(n);
  const timeSec = new Float32Array(n);
  const throttle = new Float32Array(n);
  const brake = new Float32Array(n);
  const speed = new Float32Array(n);
  const gear = new Float32Array(n);
  const absActive = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    pct[i] = f * 0.999;
    timeSec[i] = f * 104.321;
    // One braking zone around the middle of the lap.
    const braking = f > 0.45 && f < 0.55;
    brake[i] = braking ? 1 : 0;
    throttle[i] = braking ? 0 : 1;
    speed[i] = braking ? 30 : 70;
    gear[i] = braking ? 3 : 6;
    absActive[i] = 0;
  }
  return {
    fileName: 'spa gp - mycar.ibt',
    lapNumber: 5,
    lapTimeSec: 104.321,
    trackId: 18,
    trackConfigName: 'Grand Prix',
    carPath: 'mycar',
    trackLengthM: 3700,
    trackDisplayName: 'Spa',
    driverName: 'Test Driver',
    carScreenName: 'My Car',
    samples: { pct, timeSec, throttle, brake, speed, gear, absActive },
    ...overrides,
  };
};

describe('ibtSamplesToLapTrace', () => {
  it('produces a manual-source record with one sample per row', () => {
    const record = ibtSamplesToLapTrace(makeResult(), 1000);

    expect(record.source.kind).toBe('manual');
    expect(record.source.ref).toBe('spa gp - mycar.ibt');
    expect(record.source.driver).toBe('Test Driver');
    // Stored in one global slot rather than under the track and car it was
    // driven on, so the imported lap shows whatever session is running. The
    // real identity survives on `source` for the widget's label.
    expect(record.trackId).toBe(IBT_IMPORT_TRACK_ID);
    expect(record.carPath).toBe(IBT_IMPORT_CAR_PATH);
    // Blank, or the load-time layout guard would reject it off its own track.
    expect(record.trackConfigName).toBe('');
    expect(record.source.track).toBe('Spa');
    expect(record.source.car).toBe('My Car');
    expect(record.lapTimeSec).toBeCloseTo(104.321, 3);
    expect(record.recordedAt).toBe(1000);

    const { samples } = record;
    expect(samples.length).toBe(400);
    expect(samples.distanceM.length).toBe(400);
    expect(samples.distanceM[0]).toBe(0);
    expect(samples.distanceM[399]).toBeCloseTo(0.999 * 3700, 1);
    for (let i = 1; i < samples.length; i++) {
      expect(samples.distanceM[i]).toBeGreaterThan(samples.distanceM[i - 1]);
      expect(samples.timeSec[i]).toBeGreaterThanOrEqual(samples.timeSec[i - 1]);
    }
    expect(samples.timeSec[0]).toBe(0);
    expect(samples.timeSec[399]).toBeCloseTo(104.321, 3);
  });

  it('yields the braking zone as a brake-on event on hydrate', () => {
    const record = ibtSamplesToLapTrace(makeResult());
    const { events } = hydrateLapTrace(record);
    expect(events.brakeOnM.length).toBe(1);
    // The single braking zone starts near the middle of a 3700 m lap.
    expect(events.brakeOnM[0]).toBeGreaterThan(3700 * 0.4);
    expect(events.brakeOnM[0]).toBeLessThan(3700 * 0.55);
    expect(events.brakeOffM.length).toBe(1);
    expect(events.throttleOnM.length).toBe(1);
  });

  it('drops rows that do not advance along the lap', () => {
    const result = makeResult();
    // Freeze the car for a few rows: same position, clock still running.
    for (let i = 100; i < 105; i++)
      result.samples.pct[i] = result.samples.pct[99];
    const record = ibtSamplesToLapTrace(result);
    expect(record.samples.length).toBe(395);
  });

  it('refuses a lap with no drivable samples', () => {
    const result = makeResult();
    result.samples.pct.fill(0.5);
    expect(() => ibtSamplesToLapTrace(result)).toThrow(/no usable samples/i);
  });

  it('falls back to the file name for the label when names are absent', () => {
    const record = ibtSamplesToLapTrace(
      makeResult({
        driverName: undefined,
        carScreenName: undefined,
        trackDisplayName: undefined,
      })
    );
    expect(record.source.label).toBe('spa gp - mycar.ibt');
  });
});
