import { describe, expect, it } from 'vitest';
import { getDemoWeatherSample } from './demoWeather';

describe('getDemoWeatherSample', () => {
  it('cycles wetness over time', () => {
    expect(getDemoWeatherSample(0).wetness).toBe(1);
    expect(getDemoWeatherSample(6).wetness).toBe(2);
    expect(getDemoWeatherSample(12).wetness).toBe(4);
  });
});
