import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { DriverControlsProcessor } from './DriverControlsProcessor';

const frame = (values: Record<string, number | boolean>): Telemetry =>
  Object.fromEntries(
    Object.entries(values).map(([key, current]) => [key, { value: [current] }])
  ) as unknown as Telemetry;

describe('DriverControlsProcessor', () => {
  it('projects full-precision input and engine values', () => {
    const processor = new DriverControlsProcessor();
    processor.init({} as Session);
    processor.onFrame(
      frame({
        Brake: 0.123456,
        BrakeRaw: 0.223456,
        Throttle: 0.765432,
        Clutch: 0.25,
        Gear: 3,
        Speed: 52.4,
        SteeringWheelAngle: -0.4321,
        BrakeABSactive: true,
        RPM: 6342,
      })
    );

    expect(processor.snapshot()).toMatchObject({
      brake: 0.123456,
      brakeRaw: 0.223456,
      throttle: 0.765432,
      clutch: 0.25,
      gear: 3,
      speed: 52.4,
      steeringWheelAngle: -0.4321,
      brakeAbsActive: true,
      rpm: 6342,
      version: 1,
    });
  });

  it('publishes only changes and resets at lifecycle boundaries', () => {
    const processor = new DriverControlsProcessor();
    const telemetry = frame({ Gear: 2, RPM: 5000 });
    processor.onFrame(telemetry);
    expect(processor.snapshot().version).toBe(1);
    processor.onFrame(telemetry);
    expect(processor.snapshot().version).toBe(1);

    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot()).toMatchObject({
      gear: undefined,
      rpm: undefined,
      version: 2,
    });
  });
});
