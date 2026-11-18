import type { LmuSectorBoundaries } from './sectorBoundaries';

export interface BundledLmuSectorBoundaries {
  trackId: number;
  trackName: string;
  boundaries: LmuSectorBoundaries;
}

export const BUNDLED_LMU_SECTOR_BOUNDARIES: readonly BundledLmuSectorBoundaries[] =
  [
    {
      trackId: 694510461,
      trackName: 'WeatherTech Raceway Laguna Seca',
      boundaries: [0.3904, 0.7925],
    },
  ];

export const LMU_SECTOR_BOUNDARY_DEFAULTS: ReadonlyMap<
  string,
  LmuSectorBoundaries
> = new Map(
  BUNDLED_LMU_SECTOR_BOUNDARIES.map(({ trackId, boundaries }) => [
    String(trackId),
    boundaries,
  ])
);
