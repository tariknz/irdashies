import { describe, expect, it } from 'vitest';
import { buildSimulatorUsageProperties } from './simulatorUsageReport';

describe('buildSimulatorUsageProperties', () => {
  it('has nothing to report when no simulator was used', () => {
    expect(buildSimulatorUsageProperties({})).toBeUndefined();
  });

  it('marks each simulator used with its time, and names the last and first', () => {
    expect(
      buildSimulatorUsageProperties({
        lmu: { first: 2, last: 2, ms: 5_400_000 },
        iracing: { first: 1, last: 1, ms: 1_200_000 },
      })
    ).toEqual({
      $set: {
        last_simulator: 'lmu',
        used_iracing: true,
        used_lmu: true,
        iracing_connected_minutes: 20,
        lmu_connected_minutes: 90,
      },
      $set_once: { first_simulator: 'iracing' },
    });
  });

  it('names the simulator connected first, even when it connected again last', () => {
    // iRacing, then LMU, then iRacing again.
    expect(
      buildSimulatorUsageProperties({
        iracing: { first: 1, last: 3, ms: 0 },
        lmu: { first: 2, last: 2, ms: 0 },
      })
    ).toMatchObject({
      $set: { last_simulator: 'iracing' },
      $set_once: { first_simulator: 'iracing' },
    });
    // LMU, then iRacing, then LMU again.
    expect(
      buildSimulatorUsageProperties({
        iracing: { first: 2, last: 2, ms: 0 },
        lmu: { first: 1, last: 3, ms: 0 },
      })
    ).toMatchObject({
      $set: { last_simulator: 'lmu' },
      $set_once: { first_simulator: 'lmu' },
    });
  });

  it('gives the time in whole minutes, rounded up', () => {
    expect(
      buildSimulatorUsageProperties({ lmu: { first: 1, last: 1, ms: 90_499 } })
    ).toEqual({
      $set: {
        last_simulator: 'lmu',
        used_lmu: true,
        lmu_connected_minutes: 2,
      },
      $set_once: { first_simulator: 'lmu' },
    });
    const minutes = (ms: number) =>
      buildSimulatorUsageProperties({ lmu: { first: 1, last: 1, ms } })?.$set
        .lmu_connected_minutes;
    expect(minutes(0)).toBe(0);
    expect(minutes(500)).toBe(1);
    expect(minutes(60_000)).toBe(1);
    expect(minutes(60_001)).toBe(2);
  });
});
