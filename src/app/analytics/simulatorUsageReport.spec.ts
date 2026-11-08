import { describe, expect, it } from 'vitest';
import { buildSimulatorUsageProperties } from './simulatorUsageReport';

describe('buildSimulatorUsageProperties', () => {
  it('has nothing to report when no simulator was used', () => {
    expect(buildSimulatorUsageProperties({})).toBeUndefined();
  });

  it('marks each simulator used with its time, and names the last and first', () => {
    expect(
      buildSimulatorUsageProperties({
        lmu: { at: 3000, ms: 5_400_000 },
        iracing: { at: 1000, ms: 1_200_000 },
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
    expect(
      buildSimulatorUsageProperties({
        lmu: { at: 1000, ms: 0 },
        iracing: { at: 3000, ms: 0 },
      })?.$set.last_simulator
    ).toBe('iracing');
  });

  it('rounds the time to the second', () => {
    expect(
      buildSimulatorUsageProperties({ lmu: { at: 1000, ms: 90_499 } })
    ).toEqual({
      $set: {
        last_simulator: 'lmu',
        used_lmu: true,
        lmu_connected_seconds: 90,
      },
      $set_once: { first_simulator: 'lmu' },
    });
    expect(
      buildSimulatorUsageProperties({ lmu: { at: 1000, ms: 500 } })?.$set
        .lmu_connected_seconds
    ).toBe(1);
  });
});
