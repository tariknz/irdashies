import { buildHashedTrackReport } from './hashedTrackReport';

export const MAX_SECTOR_BOUNDARY_PROPERTIES_BYTES = 512 * 1024;

export const buildLmuSectorBoundaryReport = (
  records: Record<string, { s2StartPct: number; s3StartPct: number }>,
  version: string
) =>
  buildHashedTrackReport(
    records,
    version,
    ({ s2StartPct, s3StartPct }) => [s2StartPct, s3StartPct],
    ({ s2StartPct, s3StartPct }) => ({
      s2_start_pct: s2StartPct,
      s3_start_pct: s3StartPct,
    })
  );
