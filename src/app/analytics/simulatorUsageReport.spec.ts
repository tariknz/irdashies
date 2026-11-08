import { describe, expect, it } from 'vitest';
import { buildSimulatorUsageProperties } from './simulatorUsageReport';

describe('buildSimulatorUsageProperties', () => {
  it('has nothing to report when no simulator connected', () => {
    expect(buildSimulatorUsageProperties({})).toBeUndefined();
  });

  it('marks each simulator used, and names the last and first by time', () => {
    expect(buildSimulatorUsageProperties({ lmu: 3000, iracing: 1000 })).toEqual(
      {
        $set: { last_simulator: 'lmu', used_iracing: true, used_lmu: true },
        $set_once: { first_simulator: 'iracing' },
      }
    );
    expect(buildSimulatorUsageProperties({ lmu: 1000, iracing: 3000 })).toEqual(
      {
        $set: { last_simulator: 'iracing', used_iracing: true, used_lmu: true },
        $set_once: { first_simulator: 'lmu' },
      }
    );
  });

  it('sets only the simulators that connected', () => {
    expect(buildSimulatorUsageProperties({ lmu: 1000 })).toEqual({
      $set: { last_simulator: 'lmu', used_lmu: true },
      $set_once: { first_simulator: 'lmu' },
    });
  });
});
