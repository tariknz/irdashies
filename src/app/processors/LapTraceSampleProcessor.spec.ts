import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { LapTraceSampleProcessor } from './LapTraceSampleProcessor';

const frame = (values: Record<string, number | boolean>): Telemetry =>
  Object.fromEntries(
    Object.entries(values).map(([key, current]) => [key, { value: [current] }])
  ) as unknown as Telemetry;

const driving = (overrides: Record<string, number | boolean> = {}) =>
  frame({
    SessionTime: 12.5,
    LapDistPct: 0.4321,
    Throttle: 0.87,
    Brake: 0.02,
    ThrottleRaw: 0.91,
    BrakeRaw: 0.05,
    Speed: 61.2,
    Gear: 4,
    BrakeABSactive: false,
    OnPitRoad: false,
    IsOnTrack: true,
    SessionNum: 1,
    LapLastLapTime: 95.123,
    LapCompleted: 3,
    PlayerCarMyIncidentCount: 2,
    ...overrides,
  });

describe('LapTraceSampleProcessor', () => {
  it('projects every field from one frame at full precision', () => {
    const processor = new LapTraceSampleProcessor();
    processor.init({} as Session);
    processor.onFrame(driving());

    expect(processor.snapshot()).toEqual({
      sessionTime: 12.5,
      lapDistPct: 0.4321,
      // The raw pedals, not the processed Throttle/Brake channels.
      throttle: 0.91,
      brake: 0.05,
      speed: 61.2,
      gear: 4,
      brakeAbsActive: false,
      onPitRoad: false,
      isOnTrack: true,
      sessionNum: 1,
      lastLapTime: 95.123,
      lapCompleted: 3,
      incidentCount: 2,
      version: 1,
    });
  });

  it('does not bump the version when only SessionTime advances', () => {
    const processor = new LapTraceSampleProcessor();
    processor.onFrame(driving({ SessionTime: 1 }));
    processor.onFrame(driving({ SessionTime: 1.0167 }));
    expect(processor.snapshot().version).toBe(1);
    // The clock is still tracked, so the next real change carries the
    // current time.
    expect(processor.snapshot().sessionTime).toBe(1.0167);
  });

  it('bumps the version when position or a pedal moves', () => {
    const processor = new LapTraceSampleProcessor();
    processor.onFrame(driving());
    processor.onFrame(driving({ LapDistPct: 0.4322 }));
    expect(processor.snapshot().version).toBe(2);
    processor.onFrame(driving({ LapDistPct: 0.4322, BrakeRaw: 0.5 }));
    expect(processor.snapshot().version).toBe(3);
  });

  it('ignores the processed pedal channels while a raw one is published', () => {
    const processor = new LapTraceSampleProcessor();
    processor.onFrame(driving());
    const { version } = processor.snapshot();

    // iRacing's auto-clutch/anti-stall moving the processed value is not the
    // driver moving their foot, so the trace must not register it.
    processor.onFrame(driving({ Throttle: 0.1, Brake: 0.9 }));

    expect(processor.snapshot()).toMatchObject({
      throttle: 0.91,
      brake: 0.05,
      version,
    });
  });

  it('falls back to sentinels when variables are missing', () => {
    const processor = new LapTraceSampleProcessor();
    processor.onFrame(frame({ Throttle: 0.5 }));
    expect(processor.snapshot()).toMatchObject({
      sessionTime: -1,
      lapDistPct: -1,
      // No ThrottleRaw in the frame, so the processed channel stands in.
      throttle: 0.5,
      brake: 0,
      sessionNum: -1,
      isOnTrack: false,
    });
  });

  it('resets to defaults at lifecycle boundaries and keeps counting versions', () => {
    const processor = new LapTraceSampleProcessor();
    processor.onFrame(driving());
    processor.onLifecycle({ type: 'enter', replay: false });
    expect(processor.snapshot().version).toBe(1);

    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot()).toMatchObject({
      sessionTime: -1,
      lapDistPct: -1,
      throttle: 0,
      sessionNum: null,
      version: 2,
    });

    processor.onFrame(driving());
    processor.onLifecycle({ type: 'disconnect' });
    expect(processor.snapshot().lapDistPct).toBe(-1);
    expect(processor.snapshot().version).toBe(4);
  });
});
