import { describe, expect, it } from 'vitest';
import {
  rainAlertIn,
  rainTileClass,
  surfaceStatus,
  tempTrend,
} from './weatherStatus';

const h = (hour: number, airTemp: number, precipitationPct: number) => ({
  hour,
  airTemp,
  precipitationPct,
});

describe('surfaceStatus', () => {
  it('maps iRacing wetness to dry, damp and wet', () => {
    expect(surfaceStatus(1).label).toBe('DRY');
    expect(surfaceStatus(2).label).toBe('DRY');
    expect(surfaceStatus(3).label).toBe('DAMP');
    expect(surfaceStatus(4).label).toBe('DAMP');
    expect(surfaceStatus(5).label).toBe('WET');
    expect(surfaceStatus(7).label).toBe('WET');
  });

  it('shows a dash when wetness is unknown', () => {
    expect(surfaceStatus(0).label).toBe('--');
    expect(surfaceStatus(undefined).label).toBe('--');
  });
});

describe('tempTrend', () => {
  const f = (end: number) => [h(1, 20, 0), h(2, 20, 0), h(3, end, 0)];
  it('points up, down or flat past a 2 degree change', () => {
    expect(tempTrend(20, f(23)).arrow).toBe('↑');
    expect(tempTrend(20, f(17)).arrow).toBe('↓');
    expect(tempTrend(20, f(21)).arrow).toBe('→');
  });

  it('is flat without data', () => {
    expect(tempTrend(undefined, f(30)).arrow).toBe('→');
    expect(tempTrend(20, []).arrow).toBe('→');
  });
});

describe('rainAlertIn', () => {
  it('is the hours until the first tile at or above the threshold', () => {
    expect(rainAlertIn([h(1, 20, 10), h(2, 20, 30), h(3, 20, 90)])).toBe(2);
  });

  it('is undefined when it stays dry', () => {
    expect(rainAlertIn([h(1, 20, 0), h(2, 20, 29)])).toBeUndefined();
  });
});

describe('rainTileClass', () => {
  it('gets bluer as rain gets likelier', () => {
    expect(rainTileClass(0)).toContain('slate');
    expect(rainTileClass(20)).toContain('blue-950');
    expect(rainTileClass(50)).toContain('blue-700');
    expect(rainTileClass(80)).toContain('blue-600');
  });
});
