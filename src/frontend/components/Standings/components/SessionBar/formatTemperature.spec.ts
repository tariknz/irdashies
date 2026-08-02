import { describe, expect, it } from 'vitest';
import { formatTemperature } from './formatTemperature';

describe('formatTemperature', () => {
  it('returns an empty string when the temperature is undefined', () => {
    expect(formatTemperature(undefined, 'Metric')).toBe('');
  });

  it('formats Celsius values as-is with a °C suffix', () => {
    expect(formatTemperature(23, 'Metric')).toBe('23°C');
  });

  it('converts to Fahrenheit with a °F suffix', () => {
    expect(formatTemperature(0, 'Imperial')).toBe('32°F');
    expect(formatTemperature(100, 'Imperial')).toBe('212°F');
  });

  it('rounds to the nearest whole degree', () => {
    expect(formatTemperature(23.6, 'Metric')).toBe('24°C');
  });
});
