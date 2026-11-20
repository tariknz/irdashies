import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { CarConditionProcessor } from './CarConditionProcessor';

const frame = (
  values: Record<string, number | boolean | readonly (number | boolean)[]>
): Telemetry =>
  Object.fromEntries(
    Object.entries(values).map(([key, current]) => [
      key,
      { value: Array.isArray(current) ? current : [current] },
    ])
  ) as unknown as Telemetry;

describe('CarConditionProcessor', () => {
  it('averages the readings across each tyre and leaves a missing corner null', () => {
    const processor = new CarConditionProcessor();
    processor.onFrame(
      frame({
        LFtempCL: 80,
        LFtempCM: 90,
        LFtempCR: 100,
        RFtempCM: 85,
        LFwearL: 0.9,
        LFwearM: 0.8,
        LFwearR: 0.7,
        LFcoldPressure: 170,
        SteeringWheelAngleMax: 7.85,
      })
    );

    const snapshot = processor.snapshot();
    expect(snapshot.tyreTemperature).toEqual([90, 85, null, null]);
    expect(snapshot.tyreWear?.[0]).toBeCloseTo(0.8);
    expect(snapshot.tyrePressure).toEqual([170, null, null, null]);
    expect(snapshot).toMatchObject({
      steeringWheelAngleMax: 7.85,
      version: 1,
    });
  });

  it('publishes nothing for a field the sim does not send', () => {
    const processor = new CarConditionProcessor();
    processor.onFrame(frame({ SteeringWheelAngleMax: 7 }));

    const snapshot = processor.snapshot();
    expect(snapshot.tyreTemperature).toBeUndefined();
    expect(snapshot.dentSeverity).toBeUndefined();
    expect(snapshot.repairNeeded).toBeUndefined();
  });

  it('ignores the fast readings that belong to car dynamics', () => {
    const processor = new CarConditionProcessor();
    processor.onFrame(frame({ LFtempCM: 80 }));
    processor.onFrame(
      frame({ LFtempCM: 80, LatAccel: 9.8, LFbrakeLinePress: 2.5 })
    );
    expect(processor.snapshot().version).toBe(1);
  });

  it('bumps the version only when a reading changes', () => {
    const processor = new CarConditionProcessor();
    processor.onFrame(frame({ LFtempCM: 80, LmuDentSeverity: [0, 1, 0] }));
    processor.onFrame(frame({ LFtempCM: 80, LmuDentSeverity: [0, 1, 0] }));
    expect(processor.snapshot().version).toBe(1);

    processor.onFrame(frame({ LFtempCM: 81, LmuDentSeverity: [0, 1, 0] }));
    expect(processor.snapshot().version).toBe(2);
  });

  it('updates the published arrays in place rather than building new ones', () => {
    const processor = new CarConditionProcessor();
    processor.onFrame(frame({ LFtempCM: 80, LmuDentSeverity: [0, 0, 0] }));
    const temperature = processor.snapshot().tyreTemperature;
    const dents = processor.snapshot().dentSeverity;

    processor.onFrame(frame({ LFtempCM: 95, LmuDentSeverity: [0, 2, 0] }));

    expect(processor.snapshot().tyreTemperature).toBe(temperature);
    expect(processor.snapshot().dentSeverity).toBe(dents);
    expect(processor.snapshot().tyreTemperature?.[0]).toBe(95);
    expect(processor.snapshot().dentSeverity).toEqual([0, 2, 0]);
  });

  it('carries damage and repair readings', () => {
    const processor = new CarConditionProcessor();
    processor.onFrame(
      frame({
        LmuDentSeverity: [0, 1, 2, 0, 0, 0, 0, 0],
        LmuWheelDetached: [false, true, false, false],
        LmuSuspensionDamage: [0, 0.3, 0, 0],
        LmuAeroDamage: 0.25,
        LmuRepairTime: 42,
        PitRepairLeft: 12.5,
        PitOptRepairLeft: 30,
        PitRepairNeeded: true,
        LmuBodyDetached: true,
      })
    );

    expect(processor.snapshot()).toMatchObject({
      dentSeverity: [0, 1, 2, 0, 0, 0, 0, 0],
      wheelDetached: [false, true, false, false],
      suspensionDamage: [0, 0.3, 0, 0],
      aeroDamage: 0.25,
      lmuRepairTime: 42,
      pitRepairLeft: 12.5,
      pitOptRepairLeft: 30,
      repairNeeded: true,
      bodyDetached: true,
    });
  });

  it('clears every reading when the session ends', () => {
    const processor = new CarConditionProcessor();
    processor.onFrame(frame({ LFtempCM: 80, LmuDentSeverity: [1] }));
    processor.onLifecycle({ type: 'enter', replay: false });
    expect(processor.snapshot().version).toBe(1);

    processor.onLifecycle({ type: 'disconnect' });
    expect(processor.snapshot()).toEqual({ version: 2 });
  });
});
