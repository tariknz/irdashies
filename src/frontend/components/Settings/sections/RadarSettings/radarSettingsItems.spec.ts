import { describe, expect, it } from 'vitest';
import { RADAR_MISSING_SPECS, RADAR_SECTIONS } from './radarSettingsItems';

describe('RADAR_SECTIONS', () => {
  // A missing spec only hides its row at runtime, so catch it here.
  it('finds a manifest spec of the right kind for every toggle and slider', () => {
    expect(RADAR_SECTIONS.length).toBeGreaterThan(0);
    expect(RADAR_MISSING_SPECS).toEqual([]);
  });
});
