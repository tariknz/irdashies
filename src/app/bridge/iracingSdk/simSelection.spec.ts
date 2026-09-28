import { describe, expect, it } from 'vitest';
import {
  getSimulatorOverride,
  resolveSimulatorPreference,
  resolveWithoutProbing,
  selectDetectedSimulator,
  shouldReuseBridge,
} from './simSelection';

describe('getSimulatorOverride', () => {
  it('reads --sim= from the command line', () => {
    expect(getSimulatorOverride(['--sim=lmu'], undefined)).toBe('lmu');
    expect(getSimulatorOverride(['--sim=iracing'], undefined)).toBe('iracing');
  });

  it('falls back to the environment variable', () => {
    expect(getSimulatorOverride([], 'lmu')).toBe('lmu');
  });

  it('prefers the argument over the environment variable', () => {
    expect(getSimulatorOverride(['--sim=iracing'], 'lmu')).toBe('iracing');
  });

  it('ignores anything that does not name a simulator', () => {
    expect(getSimulatorOverride(['--sim=rfactor'], undefined)).toBeUndefined();
    expect(getSimulatorOverride([], '')).toBeUndefined();
    expect(getSimulatorOverride([], undefined)).toBeUndefined();
  });
});

describe('resolveSimulatorPreference', () => {
  const both = ['iracing', 'lmu'] as const;

  it('uses the stored preference when the sim is available', () => {
    expect(resolveSimulatorPreference('lmu', undefined, [...both])).toBe('lmu');
  });

  it('probes when the preference is auto or unset', () => {
    expect(
      resolveSimulatorPreference('auto', undefined, [...both])
    ).toBeUndefined();
    expect(
      resolveSimulatorPreference(undefined, undefined, [...both])
    ).toBeUndefined();
  });

  it('lets an override beat the stored preference', () => {
    expect(resolveSimulatorPreference('iracing', 'lmu', [...both])).toBe('lmu');
    expect(resolveSimulatorPreference('auto', 'iracing', [...both])).toBe(
      'iracing'
    );
  });

  it('falls back to detection when this build has no source for the preference', () => {
    // The setting outlived the source it named. Detecting is better than
    // leaving the app with no telemetry at all.
    expect(resolveSimulatorPreference('lmu', undefined, ['iracing'])).toBe(
      undefined
    );
  });

  it('honours an override for a simulator that is not available', () => {
    // A developer forcing an absent sim should see it fail, not be quietly
    // redirected to another one.
    expect(resolveSimulatorPreference('auto', 'lmu', ['iracing'])).toBe('lmu');
  });
});

describe('resolveWithoutProbing', () => {
  it('picks the only simulator in the build', () => {
    // Nothing to detect, so a single-sim build takes exactly the path it took
    // before simulator selection existed -- no probe loop in front of it.
    expect(resolveWithoutProbing(['iracing'])).toBe('iracing');
  });

  it('defers to probing when there is a choice to make', () => {
    expect(resolveWithoutProbing(['iracing', 'lmu'])).toBeUndefined();
  });

  it('has nothing to pick when no source is present', () => {
    expect(resolveWithoutProbing([])).toBeUndefined();
  });
});

describe('selectDetectedSimulator', () => {
  it('takes the first running simulator, in registry priority order', () => {
    expect(
      selectDetectedSimulator([
        { id: 'iracing', active: false },
        { id: 'lmu', active: true },
      ])
    ).toBe('lmu');
    expect(
      selectDetectedSimulator([
        { id: 'iracing', active: true },
        { id: 'lmu', active: true },
      ])
    ).toBe('iracing');
  });

  it('keeps probing while nothing is running', () => {
    expect(
      selectDetectedSimulator([
        { id: 'iracing', active: false },
        { id: 'lmu', active: false },
      ])
    ).toBeUndefined();
    expect(selectDetectedSimulator([])).toBeUndefined();
  });
});

describe('shouldReuseBridge', () => {
  const live = {
    hasLiveBridge: true,
    isMock: false,
    simulator: 'iracing' as const,
    activeSimulator: 'iracing' as const,
  };

  it('keeps the bridge when the rebuild would produce the same one', () => {
    // On a single-source build 'auto' and a pinned iRacing both resolve to
    // iracing, so moving between them would tear telemetry down and build the
    // identical thing back.
    expect(shouldReuseBridge(live)).toBe(true);
  });

  it('rebuilds when the simulator actually changes', () => {
    expect(shouldReuseBridge({ ...live, simulator: 'lmu' })).toBe(false);
  });

  it('rebuilds when no bridge is up yet', () => {
    // activeSimulator is written before the publisher returns, so a matching
    // id does not prove a bridge is running. The handle is the readiness
    // signal, and initial setup must not be skipped.
    expect(shouldReuseBridge({ ...live, hasLiveBridge: false })).toBe(false);
  });

  it('rebuilds when the live source is a mock', () => {
    // Demo mode and the non-Windows mock leave activeSimulator unset and are
    // not the sim-specific bridge a match would imply.
    expect(shouldReuseBridge({ ...live, isMock: true })).toBe(false);
  });

  it('rebuilds when auto has not resolved to a simulator', () => {
    // 'auto' on a multi-source build is undefined pending a probe. Two
    // undefineds are not a match, or switching to Auto would never re-probe.
    expect(
      shouldReuseBridge({
        hasLiveBridge: true,
        isMock: false,
        simulator: undefined,
        activeSimulator: undefined,
      })
    ).toBe(false);
  });

  it('rebuilds while auto-detection is still probing', () => {
    expect(shouldReuseBridge({ ...live, activeSimulator: undefined })).toBe(
      false
    );
  });
});
