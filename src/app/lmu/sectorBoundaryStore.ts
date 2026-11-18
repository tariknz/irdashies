import {
  isPlausibleLmuSectorBoundaries,
  type LmuSectorBoundaries,
} from './sectorBoundaries';

/** LMU track id (as a string) -> the sector starts measured there. */
export type LmuSectorBoundaryRecords = Record<
  string,
  { s2StartPct: number; s3StartPct: number }
>;

export interface LmuSectorBoundaryPersistence {
  read(): unknown;
  write(records: LmuSectorBoundaryRecords): void;
}

const MAX_TRACKS = 10000;
const TRACK_ID = /^[1-9]\d{0,9}$/;
const PRECISION = 10000;
/** About 4 m on a 4 km lap: a measurement this close is the same line. */
const SAME_LINE = 0.001;

const round = (value: number): number =>
  Math.round(value * PRECISION) / PRECISION;

/** The stored file is untrusted: keep canonical ids with plausible pairs. */
export const parseLmuSectorBoundaries = (
  raw: unknown
): LmuSectorBoundaryRecords => {
  const records: LmuSectorBoundaryRecords = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return records;
  for (const [id, entry] of Object.entries(raw).slice(0, MAX_TRACKS)) {
    if (!TRACK_ID.test(id) || !entry || typeof entry !== 'object') continue;
    const { s2StartPct, s3StartPct } = entry as Record<string, unknown>;
    if (
      typeof s2StartPct !== 'number' ||
      typeof s3StartPct !== 'number' ||
      !isPlausibleLmuSectorBoundaries(s2StartPct, s3StartPct)
    ) {
      continue;
    }
    records[id] = { s2StartPct, s3StartPct };
  }
  return records;
};

/** The sector starts the player measured, per LMU track. */
export class LmuSectorBoundaryStore {
  private records: LmuSectorBoundaryRecords | undefined;

  constructor(private readonly persistence: LmuSectorBoundaryPersistence) {}

  private current(): LmuSectorBoundaryRecords {
    return this.records ?? parseLmuSectorBoundaries(this.persistence.read());
  }

  get(trackId: string): LmuSectorBoundaries | null {
    const record = this.current()[trackId];
    return record ? [record.s2StartPct, record.s3StartPct] : null;
  }

  /** Keeps a measurement, unless it finds the same lines as the stored one. */
  record(trackId: string, [s2, s3]: LmuSectorBoundaries): void {
    if (!TRACK_ID.test(trackId) || !isPlausibleLmuSectorBoundaries(s2, s3)) {
      return;
    }
    const records = this.current();
    const stored = records[trackId];
    if (
      stored &&
      Math.abs(stored.s2StartPct - s2) < SAME_LINE &&
      Math.abs(stored.s3StartPct - s3) < SAME_LINE
    ) {
      return;
    }
    this.records = {
      ...records,
      [trackId]: { s2StartPct: round(s2), s3StartPct: round(s3) },
    };
    this.persistence.write(this.records);
  }

  snapshot(): LmuSectorBoundaryRecords {
    return this.current();
  }
}
