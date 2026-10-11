import { describe, expect, it } from 'vitest';
import { formatSpeed } from './TowerCards';

describe('formatSpeed', () => {
  it("follows the sim's display units", () => {
    expect(formatSpeed(160.9344, 0)).toBe('100 mph');
    expect(formatSpeed(160.9344, 1)).toBe('161 km/h');
    expect(formatSpeed(160.9344, undefined)).toBe('161 km/h');
  });
});
