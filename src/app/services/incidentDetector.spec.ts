import { describe, it, expect } from 'vitest';
import { IncidentDetector } from './incidentDetector';
import type { IncidentThresholds } from '../../types/raceControl';

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowFrameThreshold: 10,
  suddenStopFromSpeed: 80,
  suddenStopToSpeed: 20,
  suddenStopFrames: 3,
  offTrackDebounce: 3,
  cooldownSeconds: 5,
};

describe('IncidentDetector - speed calculation', () => {
  it('calculates speed from lapDistPct delta and track length', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // 0.001 pct * 5000m = 5m in 0.04s (25Hz) → 125 m/s → 450 km/h
    const speed = detector.calculateSpeed(0.5, 0.501, 0.04, 5000);
    expect(speed).toBeCloseTo(450, 0);
  });

  it('handles lap wrap-around (lapDistPct 0.99 → 0.01)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const speed = detector.calculateSpeed(0.99, 0.01, 0.04, 5000);
    // distPct = 0.01 - 0.99 = -0.98, wrap-around: -0.98 + 1.0 = 0.02
    // 0.02 * 5000 = 100m / 0.04s = 2500 m/s * 3.6 = 9000 km/h (fast car at finish)
    expect(speed).toBeGreaterThan(0);
  });

  it('returns 0 for backwards movement (collision nudge)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const speed = detector.calculateSpeed(0.5, 0.499, 0.04, 5000);
    expect(speed).toBe(0);
  });
});

describe('session transitions', () => {
  it('clears car states when session updates', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (detector as any).carStates.set(0, { slowFrameCount: 5 });
    detector.updateSession({ DriverInfo: { Drivers: [] } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(0);
  });
});
