import { describe, expect, it } from 'vitest';
import { describeWeatherChange, type WeatherSample } from './weatherChange';

const dry: WeatherSample = { wetness: 1, precipitation: 0, trackTemp: 30 };

describe('describeWeatherChange', () => {
  it('stays quiet when nothing meaningful moved', () => {
    expect(describeWeatherChange(dry, { ...dry, trackTemp: 32 })).toBe(
      undefined
    );
  });

  it('reports rain starting and stopping', () => {
    const wet = { ...dry, precipitation: 0.4 };
    expect(describeWeatherChange(dry, wet)).toBe('Rain started');
    expect(describeWeatherChange(wet, dry)).toBe('Rain stopped');
  });

  it('does not flip on rain hovering around one level', () => {
    const drizzle = (precipitation: number) => ({ ...dry, precipitation });
    expect(describeWeatherChange(drizzle(0.03), drizzle(0.01))).toBe(undefined);
    expect(describeWeatherChange(drizzle(0), drizzle(0.01))).toBe(undefined);
  });

  it('reports the track wetness trend', () => {
    const damp = { ...dry, wetness: 3 };
    expect(describeWeatherChange(dry, damp)).toBe('Track getting wetter');
    expect(describeWeatherChange(damp, dry)).toBe('Track drying');
  });

  it('ignores an unknown wetness reading', () => {
    expect(describeWeatherChange(dry, { ...dry, wetness: 0 })).toBe(undefined);
  });

  it('reports a big track temperature swing', () => {
    expect(describeWeatherChange(dry, { ...dry, trackTemp: 34 })).toBe(
      'Track temp rising'
    );
    expect(describeWeatherChange(dry, { ...dry, trackTemp: 26 })).toBe(
      'Track temp falling'
    );
  });
});
