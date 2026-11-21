import { describe, expect, it } from 'vitest';
import { resolveLmuTrackId } from './mapSession';
import { isPlausibleLmuSectorBoundaries } from './sectorBoundaries';
import {
  BUNDLED_LMU_SECTOR_BOUNDARIES,
  LMU_SECTOR_BOUNDARY_DEFAULTS,
} from './sectorBoundaryDefaults';

describe('LMU_SECTOR_BOUNDARY_DEFAULTS', () => {
  it('finds Laguna Seca by the track id the session publishes', () => {
    const id = String(resolveLmuTrackId('WeatherTech Raceway Laguna Seca'));
    expect(LMU_SECTOR_BOUNDARY_DEFAULTS.get(id)).toEqual([0.3904, 0.7925]);
  });

  it.each(BUNDLED_LMU_SECTOR_BOUNDARIES)(
    'keys $trackName by the id LMU sessions resolve its name to',
    ({ trackId, trackName }) => {
      expect(String(resolveLmuTrackId(trackName))).toBe(String(trackId));
    }
  );

  it('holds each track once', () => {
    expect(LMU_SECTOR_BOUNDARY_DEFAULTS.size).toBe(
      BUNDLED_LMU_SECTOR_BOUNDARIES.length
    );
  });

  it('holds only plausible pairs', () => {
    for (const [s2, s3] of LMU_SECTOR_BOUNDARY_DEFAULTS.values()) {
      expect(isPlausibleLmuSectorBoundaries(s2, s3)).toBe(true);
    }
  });
});
