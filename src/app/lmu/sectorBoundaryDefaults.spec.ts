import { describe, expect, it } from 'vitest';
import { resolveLmuTrackId } from './mapSession';
import { isPlausibleLmuSectorBoundaries } from './sectorBoundaries';
import { LMU_SECTOR_BOUNDARY_DEFAULTS } from './sectorBoundaryDefaults';

describe('LMU_SECTOR_BOUNDARY_DEFAULTS', () => {
  it('finds Laguna Seca by the track id the session publishes', () => {
    const id = String(resolveLmuTrackId('WeatherTech Raceway Laguna Seca'));
    expect(LMU_SECTOR_BOUNDARY_DEFAULTS.get(id)).toEqual([0.3904, 0.7925]);
  });

  it('holds only plausible pairs', () => {
    for (const [s2, s3] of LMU_SECTOR_BOUNDARY_DEFAULTS.values()) {
      expect(isPlausibleLmuSectorBoundaries(s2, s3)).toBe(true);
    }
  });
});
