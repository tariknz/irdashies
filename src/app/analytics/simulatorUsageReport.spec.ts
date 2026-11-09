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
        iracing_connected_seconds: 1200,
        lmu_connected_seconds: 5400,
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

  it('rounds the time to the second', () => {
    expect(
      buildSimulatorUsageProperties({ lmu: { first: 1, last: 1, ms: 90_499 } })
    ).toEqual({
      $set: {
        last_simulator: 'lmu',
        used_lmu: true,
        lmu_connected_seconds: 90,
      },
      $set_once: { first_simulator: 'lmu' },
    });
    expect(
      buildSimulatorUsageProperties({ lmu: { first: 1, last: 1, ms: 500 } })
        ?.$set.lmu_connected_seconds
    ).toBe(1);
  });
});
