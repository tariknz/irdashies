import bundledGeometry from './lmu-track-geometry.json';
import {
  type BundledTrackWidth,
  type TrackWidthBundle,
  type TrackWidthBundleEntry,
} from './trackWidth';
import {
  lapDistMatches,
  lapDistWithinStretch,
  worldTrackFitsLap,
  worldTrackFrom,
  type GroundPoint,
  type StoredWorldTrack,
  type WorldTrackBundle,
} from './worldTrack';

export const TRACK_GEOMETRY_BUNDLE_VERSION = 1;

export interface TrackGeometryWorldJson {
  racing: number[];
  pitLane: number[];
  offsetCm: number;
}

export interface TrackGeometryStatsJson {
  measuredCoverage: number;
  smoothedCoverage: number;
  samples: number;
  files: number;
  createdAt: string;
  irdashiesVersion: string;
}

export interface TrackGeometryEntryJson {
  lapDistCm: number;
  world: TrackGeometryWorldJson;
  width?: BundledTrackWidth;
  stats: TrackGeometryStatsJson;
}

export interface TrackGeometryBundleJson {
  version: number;
  tracks: Record<string, TrackGeometryEntryJson>;
  sectors?: Record<string, number[]>;
}

export interface BundledTrackGeometry {
  lapDistM: number;
  world: StoredWorldTrack;
  width: TrackWidthBundleEntry | null;
}

const MIN_SECTOR_BOUNDARY = 0.02;
const MAX_SECTOR_BOUNDARY = 0.98;
const MIN_SECTOR_GAP = 0.02;

export function parseSectorBoundaries(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [s2, s3] = value;
  if (typeof s2 !== 'number' || typeof s3 !== 'number') return null;
  if (!(s2 > MIN_SECTOR_BOUNDARY) || !(s3 < MAX_SECTOR_BOUNDARY)) return null;
  if (!(s3 - s2 >= MIN_SECTOR_GAP)) return null;
  return [s2, s3];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const integers = (value: unknown, length?: number): number[] | null => {
  if (!Array.isArray(value)) return null;
  if (length !== undefined && value.length !== length) return null;
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry)) return null;
  }
  return value as number[];
};

const pointsFromCentimetres = (values: number[]): GroundPoint[] | null => {
  if (values.length % 2 !== 0) return null;
  const points: GroundPoint[] = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: values[index] / 100, y: values[index + 1] / 100 });
  }
  return points;
};

const parseWidth = (value: unknown): BundledTrackWidth | null => {
  if (!isObject(value)) return null;
  const { bins, sign } = value;
  if (typeof bins !== 'number' || !Number.isInteger(bins) || bins < 2) {
    return null;
  }
  if (sign !== 1 && sign !== -1) return null;
  const centre = integers(value.centre, bins * 2);
  const left = integers(value.left, bins);
  const right = integers(value.right, bins);
  const centreCount = integers(value.centreCount, bins);
  const leftCount = integers(value.leftCount, bins);
  const rightCount = integers(value.rightCount, bins);
  if (!centre || !left || !right || !centreCount || !leftCount || !rightCount) {
    return null;
  }
  return {
    bins,
    sign,
    centre,
    left,
    right,
    centreCount,
    leftCount,
    rightCount,
  };
};

export function parseTrackGeometryEntry(
  value: unknown
): BundledTrackGeometry | null {
  if (!isObject(value)) return null;
  const { lapDistCm, world, stats } = value;
  if (typeof lapDistCm !== 'number' || !(lapDistCm > 0)) return null;
  if (!isObject(world) || !isObject(stats)) return null;
  const racingValues = integers(world.racing);
  const pitValues = integers(world.pitLane ?? []);
  if (!racingValues || !pitValues) return null;
  const racing = pointsFromCentimetres(racingValues);
  const pitLane = pointsFromCentimetres(pitValues);
  if (!racing || !pitLane) return null;
  const { offsetCm } = world;
  if (typeof offsetCm !== 'number' || !Number.isFinite(offsetCm)) return null;
  const lapDistM = lapDistCm / 100;
  const track = worldTrackFrom(racing, pitLane);
  if (!track || !worldTrackFitsLap(track, lapDistM)) return null;
  const width = value.width === undefined ? null : parseWidth(value.width);
  if (value.width !== undefined && !width) return null;
  const samples = typeof stats.samples === 'number' ? stats.samples : 0;
  const smoothedCoverage =
    typeof stats.smoothedCoverage === 'number'
      ? stats.smoothedCoverage / 100
      : 0;
  const irdashiesVersion =
    typeof stats.irdashiesVersion === 'string'
      ? stats.irdashiesVersion
      : 'unknown';
  return {
    lapDistM,
    world: { track, offsetM: offsetCm / 100, lapDistM },
    width: width
      ? { width, samples, smoothedCoverage, irdashiesVersion }
      : null,
  };
}

export class LmuBundledTrackGeometry
  implements WorldTrackBundle, TrackWidthBundle
{
  private readonly tracks = new Map<string, BundledTrackGeometry>();
  private readonly sectors = new Map<string, readonly number[]>();

  constructor(raw: unknown) {
    if (!isObject(raw) || raw.version !== TRACK_GEOMETRY_BUNDLE_VERSION) {
      return;
    }
    if (isObject(raw.tracks)) {
      for (const [trackName, value] of Object.entries(raw.tracks)) {
        const entry = parseTrackGeometryEntry(value);
        if (entry) this.tracks.set(trackName, entry);
      }
    }
    if (isObject(raw.sectors)) {
      for (const [trackName, value] of Object.entries(raw.sectors)) {
        const boundaries = parseSectorBoundaries(value);
        if (boundaries) this.sectors.set(trackName, boundaries);
      }
    }
  }

  get size(): number {
    return this.tracks.size;
  }

  get sectorCount(): number {
    return this.sectors.size;
  }

  sectorBoundaries(
    trackName: string,
    lapDistM?: number
  ): readonly number[] | null {
    const sectors = byName(this.sectors, trackName);
    if (!sectors) return null;
    const entry = byName(this.tracks, trackName);
    if (
      entry &&
      lapDistM !== undefined &&
      lapDistM > 0 &&
      !lapDistMatches(entry.lapDistM, lapDistM) &&
      !lapDistWithinStretch(entry.lapDistM, lapDistM)
    ) {
      return null;
    }
    return sectors;
  }

  has(trackName: string): boolean {
    return byName(this.tracks, trackName) !== undefined;
  }

  worldTrack(trackName: string, lapDistM: number): StoredWorldTrack | null {
    const entry = byName(this.tracks, trackName);
    if (!entry) return null;
    return lapDistMatches(entry.lapDistM, lapDistM) ||
      lapDistWithinStretch(entry.lapDistM, lapDistM)
      ? entry.world
      : null;
  }

  trackWidth(
    trackName: string,
    lapDistM: number
  ): TrackWidthBundleEntry | null {
    const entry = byName(this.tracks, trackName);
    if (!entry || !lapDistMatches(entry.lapDistM, lapDistM)) return null;
    return entry.width;
  }
}

const normalizeTrackName = (trackName: string): string =>
  trackName.trim().replace(/\s+/g, ' ').toLowerCase();

function byName<T>(entries: Map<string, T>, trackName: string): T | undefined {
  const exact = entries.get(trackName);
  if (exact !== undefined) return exact;
  const wanted = normalizeTrackName(trackName);
  for (const [name, entry] of entries) {
    if (normalizeTrackName(name) === wanted) return entry;
  }
  return undefined;
}

let defaultGeometry: LmuBundledTrackGeometry | null = null;

export function defaultLmuTrackGeometry(): LmuBundledTrackGeometry {
  defaultGeometry ??= new LmuBundledTrackGeometry(bundledGeometry);
  return defaultGeometry;
}
