import { describe, expect, it } from 'vitest';
import {
  IRACING_UNITS_METRIC,
  kphFromSpeed,
  msFromSpeed,
  resolveSpeedUnit,
  speedFromKph,
  speedFromMs,
} from './units';

describe('resolveSpeedUnit', () => {
  it('follows iRacing when the setting is auto', () => {
    expect(resolveSpeedUnit('auto', IRACING_UNITS_METRIC)).toBe('km/h');
    expect(resolveSpeedUnit('auto', 0)).toBe('mph');
  });

  it('follows iRacing when there is no setting at all', () => {
    // Widgets that predate having a unit setting, and any that never add one.
    expect(resolveSpeedUnit(undefined, IRACING_UNITS_METRIC)).toBe('km/h');
    expect(resolveSpeedUnit(undefined, 0)).toBe('mph');
  });

  it('lets an explicit setting override iRacing', () => {
    expect(resolveSpeedUnit('mph', IRACING_UNITS_METRIC)).toBe('mph');
    expect(resolveSpeedUnit('km/h', 0)).toBe('km/h');
  });

  it('falls back to mph when DisplayUnits is missing', () => {
    // Telemetry can be absent before a session connects. Imperial matches
    // iRacing's own default for an unset value rather than inventing one.
    expect(resolveSpeedUnit('auto', undefined)).toBe('mph');
  });
});

describe('speedFromMs', () => {
  it('converts to km/h', () => {
    expect(speedFromMs(10, 'km/h')).toBeCloseTo(36, 5);
  });

  it('converts to mph', () => {
    expect(speedFromMs(10, 'mph')).toBeCloseTo(22.3694, 4);
  });

  it('leaves zero alone in both units', () => {
    expect(speedFromMs(0, 'km/h')).toBe(0);
    expect(speedFromMs(0, 'mph')).toBe(0);
  });
});

describe('speedFromKph', () => {
  it('passes km/h through untouched', () => {
    expect(speedFromKph(100, 'km/h')).toBe(100);
  });

  it('converts km/h to mph', () => {
    expect(speedFromKph(160.934, 'mph')).toBeCloseTo(100, 3);
  });
});

describe('kphFromSpeed', () => {
  it('passes km/h through untouched', () => {
    expect(kphFromSpeed(100, 'km/h')).toBe(100);
  });

  it('converts mph back to km/h', () => {
    expect(kphFromSpeed(100, 'mph')).toBeCloseTo(160.934, 3);
  });

  it('round-trips with speedFromKph', () => {
    const kph = 137.5;
    expect(kphFromSpeed(speedFromKph(kph, 'mph'), 'mph')).toBeCloseTo(kph, 6);
  });
});

describe('msFromSpeed', () => {
  it('inverts speedFromMs in km/h', () => {
    expect(msFromSpeed(speedFromMs(27.5, 'km/h'), 'km/h')).toBeCloseTo(27.5, 6);
  });

  it('inverts speedFromMs in mph', () => {
    expect(msFromSpeed(speedFromMs(27.5, 'mph'), 'mph')).toBeCloseTo(27.5, 6);
  });
});

describe('agreement between the two speed sources', () => {
  it('m/s and km/h paths give the same mph', () => {
    // The old duplicated constants were 2.23694 in one place and 3.6 / 1.60934
    // in another. They agree to within a rounding error, but nothing enforced
    // that; a single source means they cannot drift apart.
    const ms = 42;
    const viaMs = speedFromMs(ms, 'mph');
    const viaKph = speedFromKph(speedFromMs(ms, 'km/h'), 'mph');
    expect(viaMs).toBeCloseTo(viaKph, 3);
  });
});
