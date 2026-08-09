import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarLeftRight, type BlindSpotSnapshot } from '@irdashies/types';
import { useBlindSpotMonitor } from './useBlindSpotMonitor';

let blindSpotSnapshot: BlindSpotSnapshot;

vi.mock('@irdashies/context', () => ({
  useDriverCarIdx: () => 0,
  useTrackLength: () => 5000,
  useBlindSpotSelector: (selector: (snapshot: BlindSpotSnapshot) => unknown) =>
    selector(blindSpotSnapshot),
}));

vi.mock('./useBlindSpotMonitorSettings', () => ({
  useBlindSpotMonitorSettings: () => ({ distAhead: 4, distBehind: 4 }),
}));

const snapshot = (rivalProgress: number): BlindSpotSnapshot => ({
  carLeftRight: CarLeftRight.CarLeft,
  carIdxLapDistPct: [0.5, rivalProgress],
  isOnTrack: true,
  version: 1,
});

describe('useBlindSpotMonitor', () => {
  beforeEach(() => {
    blindSpotSnapshot = snapshot(0.5004);
  });

  it('does not enter a render loop while tracking an adjacent car', () => {
    let renderCount = 0;
    const { result, rerender } = renderHook(() => {
      renderCount += 1;
      return useBlindSpotMonitor();
    });

    expect(result.current.show).toBe(true);
    expect(result.current.isOnTrack).toBe(true);
    expect(result.current.leftState).toBe(CarLeftRight.CarLeft);

    blindSpotSnapshot = snapshot(0.5005);
    rerender();

    expect(result.current.leftPercent).toBeGreaterThan(0);
    expect(renderCount).toBeLessThan(10);
  });
});
