import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { CarDynamicsProcessor } from './CarDynamicsProcessor';

const frame = (values: Record<string, number>): Telemetry =>
  Object.fromEntries(
    Object.entries(values).map(([key, current]) => [key, { value: [current] }])
  ) as unknown as Telemetry;

describe('CarDynamicsProcessor', () => {
  it('publishes g-forces and the per-corner travel readings', () => {
    const processor = new CarDynamicsProcessor();
    processor.onFrame(
      frame({
        SessionTime: 120.25,
        Speed: 41.5,
        LatAccel: 9.8,
        LongAccel: -4.9,
        RRbrakeLinePress: 2.5,
        LRshockDefl: 0.031,
      })
    );

    const snapshot = processor.snapshot();
    expect(snapshot).not.toHaveProperty('sessionTime');
    expect(snapshot).not.toHaveProperty('speed');
    expect(snapshot).toMatchObject({
      lateralAccel: 9.8,
      longitudinalAccel: -4.9,
      version: 1,
    });
    expect(snapshot.brakeLinePressure).toEqual([null, null, null, 2.5]);
    expect(snapshot.suspensionDeflection).toEqual([null, null, 0.031, null]);
  });

  it('ignores the slow readings that belong to car condition', () => {
    const processor = new CarDynamicsProcessor();
    processor.onFrame(frame({ LatAccel: 1 }));
    processor.onFrame(frame({ LatAccel: 1, LFtempCM: 80, LmuAeroDamage: 0.2 }));
    expect(processor.snapshot().version).toBe(1);
    expect(processor.snapshot().brakeLinePressure).toBeUndefined();
  });

  it('publishes nothing new while only the clock and speed move', () => {
    const processor = new CarDynamicsProcessor();
    processor.onFrame(frame({ SessionTime: 1, Speed: 40, LatAccel: 2 }));
    processor.onFrame(frame({ SessionTime: 1.1, Speed: 41, LatAccel: 2 }));
    expect(processor.snapshot().version).toBe(1);
  });

  it('updates the corner arrays in place', () => {
    const processor = new CarDynamicsProcessor();
    processor.onFrame(frame({ LFbrakeLinePress: 1 }));
    const pressure = processor.snapshot().brakeLinePressure;

    processor.onFrame(frame({ LFbrakeLinePress: 3 }));

    expect(processor.snapshot().brakeLinePressure).toBe(pressure);
    expect(processor.snapshot().brakeLinePressure?.[0]).toBe(3);
    expect(processor.snapshot().version).toBe(2);
  });

  it('clears every reading when the session ends', () => {
    const processor = new CarDynamicsProcessor();
    processor.onFrame(frame({ LatAccel: 2, LFbrakeLinePress: 1 }));
    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot()).toEqual({ version: 2 });
  });
});
