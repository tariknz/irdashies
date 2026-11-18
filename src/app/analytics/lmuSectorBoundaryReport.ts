import crypto from 'node:crypto';
import type { LmuSectorBoundaryRecords } from '../lmu/sectorBoundaryStore';

/** Leave headroom for SDK metadata below PostHog's 1 MB event limit. */
export const MAX_SECTOR_BOUNDARY_PROPERTIES_BYTES = 512 * 1024;

export interface LmuSectorBoundaryReport {
  /** Identifies the measurements, whatever order they came in. */
  hash: string;
  properties: {
    version: string;
    data_hash: string;
    track_count: number;
    /** By LMU track id: where S2 and S3 start, as lap fractions. */
    tracks: Record<string, { s2_start_pct: number; s3_start_pct: number }>;
  };
}

/**
 * Only track ids and lap fractions leave the installation: no names, paths or
 * profile data. The hash ignores key order and the app version, so the same
 * measurements are never reported twice.
 */
export const buildLmuSectorBoundaryReport = (
  records: LmuSectorBoundaryRecords,
  version: string
): LmuSectorBoundaryReport => {
  const ids = Object.keys(records).sort((a, b) => Number(a) - Number(b));
  const canonical = ids.map((id) => [
    id,
    records[id].s2StartPct,
    records[id].s3StartPct,
  ]);
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
  const tracks: LmuSectorBoundaryReport['properties']['tracks'] = {};
  for (const id of ids) {
    tracks[id] = {
      s2_start_pct: records[id].s2StartPct,
      s3_start_pct: records[id].s3StartPct,
    };
  }
  return {
    hash,
    properties: {
      version,
      data_hash: hash,
      track_count: ids.length,
      tracks,
    },
  };
};
