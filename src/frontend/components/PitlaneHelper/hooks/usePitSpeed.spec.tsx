import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as context from '@irdashies/context';
import { usePitSpeed } from './usePitSpeed';

vi.mock('@irdashies/context', () => ({
  useTrackStateSelector: vi.fn(),
  useSessionStore: vi.fn(),
  trackStateSelectors: { speed: (s: { speed: number }) => s.speed },
}));

/** Speed arrives in m/s, as every speed channel in the app does. */
const render = (speedMs: number, trackPitSpeedLimit: string | undefined) => {
  vi.mocked(context.useTrackStateSelector).mockImplementation(
    (selector) => selector({ speed: speedMs } as never) as never
  );
  vi.mocked(context.useSessionStore).mockImplementation(
    (selector) =>
      selector({
        session: { WeekendInfo: { TrackPitSpeedLimit: trackPitSpeedLimit } },
      } as never) as never
  );
  return renderHook(() => usePitSpeed()).result.current;
};

describe('usePitSpeed', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads a limit written in km/h', () => {
    // 60 kph is 16.67 m/s; the limit and the speed must agree on units.
    const result = render(16.666, '60.00 kph');

    expect(result.hasLimit).toBe(true);
    expect(result.limitKph).toBeCloseTo(60, 1);
    expect(result.limitMph).toBeCloseTo(37.3, 1);
    expect(result.speedKph).toBeCloseTo(60, 1);
    expect(result.speedMph).toBeCloseTo(37.3, 1);
    expect(result.isSpeeding).toBe(false);
  });

  it('normalises a limit written in mph', () => {
    const result = render(0, '35.00 mph');

    expect(result.hasLimit).toBe(true);
    expect(result.limitMph).toBeCloseTo(35, 1);
    expect(result.limitKph).toBeCloseTo(56.3, 1);
  });

  /**
   * LMU exposes no pit speed limit. The bridge calibrates one from live
   * limiter-capped speed and leaves this blank until it has, which may never
   * happen in a session where the driver does not accelerate into the limiter.
   */
  it('reports no limit when the session leaves it blank', () => {
    const result = render(16.666, '');

    expect(result.hasLimit).toBe(false);
    // A blank string is not nullish, so it slipped past the old `?? '0 kph'`
    // default and every one of these rendered NaN.
    expect(result.limitKph).toBe(0);
    expect(result.limitMph).toBe(0);
    expect(result.deltaKph).toBe(0);
    expect(result.deltaMph).toBe(0);
    expect(Number.isNaN(result.limitKph)).toBe(false);
  });

  it('does not call a car speeding when no limit is known', () => {
    // Judged against a 0 limit, any moving car reads as severely over.
    const result = render(16.666, '');

    expect(result.isSpeeding).toBe(false);
    expect(result.isSeverelyOver).toBe(false);
    expect(result.isPulsing).toBe(false);
    expect(result.colorClass).toBe('text-green-500');
  });

  it('reports no limit when the field is absent entirely', () => {
    const result = render(0, undefined);

    expect(result.hasLimit).toBe(false);
    expect(result.limitKph).toBe(0);
  });

  it('flags speeding against a known limit', () => {
    // 65 kph against a 60 kph limit.
    const result = render(18.055, '60.00 kph');

    expect(result.isSpeeding).toBe(true);
    expect(result.isSeverelyOver).toBe(true);
    expect(result.deltaKph).toBeCloseTo(5, 0);
  });
});
