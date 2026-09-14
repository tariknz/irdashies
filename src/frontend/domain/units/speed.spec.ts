import { describe, it, expect } from 'vitest';
import { isMetricSpeed, msToDisplaySpeed, speedUnitLabel } from './speed';

describe('msToDisplaySpeed', () => {
  it('converts to km/h when metric is forced', () => {
    expect(msToDisplaySpeed(10, 'km/h', 0)).toBeCloseTo(36);
  });

  it('converts to mph when imperial is forced', () => {
    expect(msToDisplaySpeed(10, 'mph', 1)).toBeCloseTo(22.3694);
  });

  it('follows the sim setting on auto', () => {
    expect(msToDisplaySpeed(10, 'auto', 1)).toBeCloseTo(36);
    expect(msToDisplaySpeed(10, 'auto', 0)).toBeCloseTo(22.3694);
  });

  it('treats missing telemetry as metric', () => {
    expect(msToDisplaySpeed(10, 'auto', undefined)).toBeCloseTo(36);
  });

  it('returns 0 rather than NaN for missing speed', () => {
    expect(msToDisplaySpeed(undefined, 'auto', 1)).toBe(0);
  });
});

describe('isMetricSpeed', () => {
  it('ignores the sim setting when the unit is explicit', () => {
    expect(isMetricSpeed('km/h', 0)).toBe(true);
    expect(isMetricSpeed('mph', 1)).toBe(false);
  });
});

describe('speedUnitLabel', () => {
  it('labels the resolved unit', () => {
    expect(speedUnitLabel('auto', 1)).toBe('km/h');
    expect(speedUnitLabel('auto', 0)).toBe('mph');
    expect(speedUnitLabel('mph', 1)).toBe('mph');
  });
});
