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

/** The lap-fraction fallback: no offsets, as iRacing reports none. */
const snapshot = (rivalProgress: number): BlindSpotSnapshot => ({
  carLeftRight: CarLeftRight.CarLeft,
  carIdxLapDistPct: [0.5, rivalProgress],
  isOnTrack: true,
  leftLongitudinalM: null,
  rightLongitudinalM: null,
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

describe('useBlindSpotMonitor with true relative offsets', () => {
  /**
   * A sim reporting real metres. The bar then spans distAhead/distBehind in
   * metres directly, instead of a lap-fraction difference whose resolution
   * depends on how fast the sim updates positions.
   */
  const withOffsets = (
    left: number | null,
    right: number | null = null,
    state = CarLeftRight.CarLeft
  ): BlindSpotSnapshot => ({
    carLeftRight: state,
    // Deliberately empty: the producer omits it when offsets are supplied, so
    // the array never crosses the channel.
    carIdxLapDistPct: [],
    isOnTrack: true,
    leftLongitudinalM: left,
    rightLongitudinalM: right,
    version: 1,
  });

  it('places a car abeam at the centre of the bar', () => {
    blindSpotSnapshot = withOffsets(0);
    const { result } = renderHook(() => useBlindSpotMonitor());

    expect(result.current.show).toBe(true);
    expect(result.current.leftPercent).toBe(0);
  });

  it('scales metres against the configured distances', () => {
    // 2 m ahead of a 4 m window is half scale.
    blindSpotSnapshot = withOffsets(2);
    expect(
      renderHook(() => useBlindSpotMonitor()).result.current.leftPercent
    ).toBeCloseTo(0.5, 3);

    blindSpotSnapshot = withOffsets(-1);
    expect(
      renderHook(() => useBlindSpotMonitor()).result.current.leftPercent
    ).toBeCloseTo(-0.25, 3);
  });

  it('clamps a car beyond the window to the end of the bar', () => {
    blindSpotSnapshot = withOffsets(40);
    expect(
      renderHook(() => useBlindSpotMonitor()).result.current.leftPercent
    ).toBe(1);
  });

  it('sweeps smoothly through an overtake rather than jumping', () => {
    // The reported fault: the bar slammed between extremes because opponent
    // lap distance stepped further per update than the whole window. True
    // metres move continuously, so consecutive frames stay adjacent.
    const seen: number[] = [];
    for (let metres = -4; metres <= 4; metres += 0.5) {
      blindSpotSnapshot = withOffsets(metres);
      seen.push(
        renderHook(() => useBlindSpotMonitor()).result.current.leftPercent
      );
    }

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
      // Never a teleport, which is what killed the CSS transition before.
      expect(Math.abs(seen[i] - seen[i - 1])).toBeLessThanOrEqual(0.5);
    }
    expect(seen[0]).toBe(-1);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('reads the right slot independently', () => {
    blindSpotSnapshot = withOffsets(null, -2, CarLeftRight.CarRight);
    const { result } = renderHook(() => useBlindSpotMonitor());

    expect(result.current.rightPercent).toBeCloseTo(-0.5, 3);
    expect(result.current.leftPercent).toBe(0);
  });

  it('works without a track length, which it no longer needs', () => {
    // The fallback divides by it; the offset path does not.
    blindSpotSnapshot = withOffsets(2);
    const { result } = renderHook(() => useBlindSpotMonitor());

    expect(result.current.show).toBe(true);
    expect(result.current.leftPercent).toBeCloseTo(0.5, 3);
  });
});

describe('useBlindSpotMonitor bar direction', () => {
  /**
   * The direction the bar travels, pinned against observed behaviour.
   *
   * BlindSpotMonitorIndicator renders `top: 25 - percent * 75`, so a positive
   * percent is up the screen and a negative one down. A car arriving from
   * behind must therefore start negative and climb -- it read the other way
   * round in a real session, which is the regression this guards.
   */
  const atMetres = (metres: number): BlindSpotSnapshot => ({
    carLeftRight: CarLeftRight.CarLeft,
    carIdxLapDistPct: [],
    isOnTrack: true,
    leftLongitudinalM: metres,
    rightLongitudinalM: null,
    version: 1,
  });

  it('puts a car behind below centre and a car ahead above it', () => {
    blindSpotSnapshot = atMetres(-2);
    expect(
      renderHook(() => useBlindSpotMonitor()).result.current.leftPercent
    ).toBeLessThan(0);

    blindSpotSnapshot = atMetres(2);
    expect(
      renderHook(() => useBlindSpotMonitor()).result.current.leftPercent
    ).toBeGreaterThan(0);
  });

  it('climbs as a car overtakes from behind', () => {
    // Exactly the move that exposed the inverted sign: alongside from the
    // rear, through abeam, to clear ahead.
    const seen = [-4, -2, 0, 2, 4].map((metres) => {
      blindSpotSnapshot = atMetres(metres);
      return renderHook(() => useBlindSpotMonitor()).result.current.leftPercent;
    });

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    }
    expect(seen[0]).toBe(-1);
    expect(seen[seen.length - 1]).toBe(1);
  });
});
