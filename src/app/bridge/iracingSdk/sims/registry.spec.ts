import { describe, expect, it } from 'vitest';
import {
  getAvailableSimulators,
  getSimDefinition,
  getSimDefinitions,
  isSimulatorAvailable,
} from './registry';

describe('sim registry', () => {
  it('discovers the simulators present in this build', () => {
    // iRacing is the one source always in the tree. Others are optional: a
    // build without them discovers nothing for them and the settings window
    // greys them out, rather than the build failing on a missing import.
    expect(getAvailableSimulators()).toContain('iracing');
    expect(isSimulatorAvailable('iracing')).toBe(true);
  });

  it('reports a simulator with no source in this build as unavailable', () => {
    const available = getAvailableSimulators();
    if (available.includes('lmu')) {
      expect(isSimulatorAvailable('lmu')).toBe(true);
      return;
    }
    expect(isSimulatorAvailable('lmu')).toBe(false);
    expect(getSimDefinition('lmu')).toBeUndefined();
  });

  it('orders definitions by auto-detect priority', () => {
    const priorities = getSimDefinitions().map(({ priority }) => priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it('gives every definition a distinct id', () => {
    const ids = getAvailableSimulators();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps definition modules cheap to import', () => {
    // The registry loads every definition eagerly to answer "which sims does
    // this build support?". Native code must therefore sit behind the lazy
    // hooks, never at module scope.
    getSimDefinitions().forEach((definition) => {
      expect(typeof definition.createProbe).toBe('function');
      expect(typeof definition.loadBridge).toBe('function');
    });
  });

  it('has nothing to return for an unset id', () => {
    expect(getSimDefinition(undefined)).toBeUndefined();
    expect(isSimulatorAvailable(undefined)).toBe(false);
  });
});
