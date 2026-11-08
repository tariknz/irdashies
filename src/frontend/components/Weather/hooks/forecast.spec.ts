import { describe, expect, it } from 'vitest';
import { appendSample, forecastFromTrend } from './forecast';

const s = (h: number, airTemp: number, precipitation = 0) => ({
  timeOfDay: h * 3600,
  airTemp,
  precipitation,
});

describe('forecastFromTrend', () => {
  it('is empty without samples', () => {
    expect(forecastFromTrend([])).toEqual([]);
  });

  it('stays flat while the history is too short to show a slope', () => {
    const f = forecastFromTrend([s(12, 20), s(12.05, 25)]);
    expect(f.map((x) => x.airTemp)).toEqual([25, 25, 25]);
  });

  it('extends a warming trend to the next full hours', () => {
    const f = forecastFromTrend([s(11, 20), s(12, 22)]);
    expect(f.map((x) => x.hour)).toEqual([13, 14, 15]);
    expect(f.map((x) => Math.round(x.airTemp))).toEqual([24, 26, 28]);
  });

  it('clamps rain to 0..100 percent', () => {
    const f = forecastFromTrend([s(11, 20, 0.2), s(12, 20, 0.6)]);
    expect(f[2].precipitationPct).toBe(100);
    const g = forecastFromTrend([s(11, 20, 0.6), s(12, 20, 0.2)]);
    expect(g[2].precipitationPct).toBe(0);
  });

  it('wraps the hour over midnight', () => {
    const f = forecastFromTrend([s(22.5, 20), s(23.5, 20)]);
    expect(f.map((x) => x.hour)).toEqual([0, 1, 2]);
  });
});

describe('appendSample', () => {
  it('drops samples older than the window', () => {
    const h = appendSample([s(8, 20), s(11.5, 20)], s(12, 20));
    expect(h.map((x) => x.timeOfDay / 3600)).toEqual([11.5, 12]);
  });

  it('starts over when the sim clock jumps back', () => {
    expect(appendSample([s(20, 20)], s(6, 20))).toEqual([s(6, 20)]);
  });
});
