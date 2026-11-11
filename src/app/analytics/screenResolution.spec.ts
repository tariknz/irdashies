import { describe, expect, it } from 'vitest';
import { physicalLength, physicalScreenSize } from './screenResolution';

/** What Electron reports for a physical length: scaled, rounded up. */
const dipOf = (physical: number, scale: number) =>
  Math.ceil(physical / scale - 1e-9);

describe('physicalScreenSize', () => {
  it('gives back a 4096x2160 screen at 250% from the 1639x864 Electron reports', () => {
    expect(
      physicalScreenSize({
        size: { width: 1639, height: 864 },
        scaleFactor: 2.5,
      })
    ).toEqual({ width: 4096, height: 2160 });
  });

  it('leaves an unscaled display as it is', () => {
    expect(
      physicalScreenSize({
        size: { width: 1920, height: 1080 },
        scaleFactor: 1,
      })
    ).toEqual({ width: 1920, height: 1080 });
  });
});

describe('physicalLength', () => {
  const resolutions: [number, number][] = [
    [1920, 1080],
    [1920, 1200],
    [2560, 1080],
    [2560, 1440],
    [2560, 1600],
    [2880, 1800],
    [3000, 2000],
    [3440, 1440],
    [3840, 1600],
    [3840, 2160],
    [4096, 2160],
    [5120, 1440],
    [5120, 2160],
    [5120, 2880],
    [6016, 3384],
    [7680, 4320],
  ];
  const scales = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

  it.each(scales)(
    'gives back every common resolution at %s scaling',
    (scale) => {
      for (const [width, height] of resolutions) {
        expect([
          physicalLength(dipOf(width, scale), scale),
          physicalLength(dipOf(height, scale), scale),
        ]).toEqual([width, height]);
      }
    }
  );

  it('gives back small laptop screens at the scales they run at', () => {
    for (const [width, height, scale] of [
      [1366, 768, 1],
      [1366, 768, 1.25],
      [1600, 900, 1.25],
      [1680, 1050, 1.25],
      [1280, 720, 1.5],
    ]) {
      expect([
        physicalLength(dipOf(width, scale), scale),
        physicalLength(dipOf(height, scale), scale),
      ]).toEqual([width, height]);
    }
  });

  it('reads a missing or nonsensical scale factor as unscaled', () => {
    expect(physicalLength(1920, Number.NaN)).toBe(1920);
    expect(physicalLength(1920, 0)).toBe(1920);
    expect(physicalLength(0, 2)).toBe(0);
  });
});
