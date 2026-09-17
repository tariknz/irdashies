import { describe, expect, it } from 'vitest';
import { getSimulatorOverride, selectDetectedSimulator } from './simSelection';

describe('simulator selection', () => {
  it('honors CLI and environment overrides', () => {
    expect(getSimulatorOverride(['--sim=lmu'], 'iracing')).toBe('lmu');
    expect(getSimulatorOverride([], 'iracing')).toBe('iracing');
  });

  it('selects LMU when only its live connection is available', () => {
    expect(selectDetectedSimulator(false, true)).toBe('lmu');
  });

  it('prefers LMU when both simulators have active sessions', () => {
    expect(selectDetectedSimulator(true, true)).toBe('lmu');
    expect(selectDetectedSimulator(true, false)).toBe('iracing');
    expect(selectDetectedSimulator(false, false)).toBeUndefined();
  });
});
