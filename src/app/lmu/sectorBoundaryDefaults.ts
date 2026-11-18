import { resolveLmuTrackId } from './mapSession';
import type { LmuSectorBoundaries } from './sectorBoundaries';

/**
 * Sector starts measured on LMU's own sector lines, by the track name LMU
 * reports. Laguna Seca comes from the recorded race in
 * test-data/telemetry/lmu-session.lmudt.
 */
const BUNDLED: readonly {
  trackName: string;
  boundaries: LmuSectorBoundaries;
}[] = [
  {
    trackName: 'WeatherTech Raceway Laguna Seca',
    boundaries: [0.3904, 0.7925],
  },
];

/** The bundled boundaries, by LMU track id (as a string). */
export const LMU_SECTOR_BOUNDARY_DEFAULTS: ReadonlyMap<
  string,
  LmuSectorBoundaries
> = new Map(
  BUNDLED.map(({ trackName, boundaries }) => [
    String(resolveLmuTrackId(trackName)),
    boundaries,
  ])
);
