import {
  TRACK_GEOMETRY_BUNDLE_VERSION,
  parseSectorBoundaries,
  parseTrackGeometryEntry,
  type TrackGeometryBundleJson,
  type TrackGeometryEntryJson,
} from '../src/app/lmu/bundledTrackGeometry';
import {
  LmuDrawnLine,
  LmuTrackWidthProfile,
  bundleBinsFor,
  bundledTrackWidthFromStored,
  parseStoredTrackWidth,
  storedTrackWidthFromBundle,
  type BundledTrackWidth,
  type StoredTrackWidth,
} from '../src/app/lmu/trackWidth';
import {
  LAP_MATCH_TOLERANCE_M,
  LmuWorldLine,
  buildWorldTrackMap,
  parseStoredWorldTrack,
  type GroundPoint,
  type LineHit,
  type StoredWorldTrack,
} from '../src/app/lmu/worldTrack';

export const MIN_SMOOTHED_COVERAGE = 0.85;
export const MIN_MEASURED_COVERAGE = 0.2;
export const MIN_SAMPLES = 2000;
export const MAX_LENGTH_DIFFERENCE = 0.005;
export const MAX_LINE_DISTANCE_M = 2;
const MAX_COUNT = 255;

export interface GeometryInput {
  file: string;
  data: unknown;
}

export interface SectorLogInput {
  file: string;
  text: string;
}

export interface GeometryExportOptions {
  createdAt: string;
  irdashiesVersion: string;
  sectorLogs?: readonly SectorLogInput[];
}

export interface GeometryExportResult {
  bundle: TrackGeometryBundleJson;
  text: string;
  report: string[];
  accepted: string[];
  refused: string[];
}

interface Candidate {
  file: string;
  world: StoredWorldTrack;
  width: StoredTrackWidth | null;
  line: LmuDrawnLine;
  samples: number;
}

interface WidthCandidate extends Candidate {
  width: StoredTrackWidth;
}

const SECTOR_LINE =
  /Learned sector boundaries for (.+?): S2 ([0-9.]+), S3 ([0-9.]+)/;
const SECTOR_DECIMALS = 4;

interface Evaluation {
  measured: number;
  smoothed: number;
  left: Float64Array;
  right: Float64Array;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const kilobytes = (bytes: number): string =>
  `${Math.max(1, Math.round(bytes / 1024))} KB`;

const drawnLineFor = (world: StoredWorldTrack): LmuDrawnLine => {
  const { map, fit } = buildWorldTrackMap(
    world.track,
    world.offsetM,
    world.lapDistM
  );
  return new LmuDrawnLine(map.active.trackPathPoints, fit);
};

const sumOf = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const candidatesFrom = (
  input: GeometryInput,
  notes: Map<string, string[]>
): { trackName: string; candidate: Candidate }[] => {
  if (!isObject(input.data)) return [];
  const found: { trackName: string; candidate: Candidate }[] = [];
  for (const [trackName, entry] of Object.entries(input.data)) {
    const note = (text: string) => {
      notes.set(trackName, [
        ...(notes.get(trackName) ?? []),
        `${input.file}: ${text}`,
      ]);
    };
    const world = parseStoredWorldTrack(entry);
    if (!world) {
      note('no valid world track');
      continue;
    }
    const width = parseStoredTrackWidth(
      isObject(entry) ? entry.width : undefined
    );
    if (!width) {
      note('no track width of the current version with a decided sign');
    }
    found.push({
      trackName,
      candidate: {
        file: input.file,
        world,
        width,
        line: drawnLineFor(world),
        samples: width ? sumOf(width.centreCount) : 0,
      },
    });
  }
  return found;
};

const largestLineDistance = (
  reference: LmuWorldLine,
  points: readonly GroundPoint[]
): number => {
  const hit: LineHit = { distance: 0, along: 0, segment: -1 };
  let hint = -1;
  let largest = 0;
  for (const point of points) {
    reference.project(point.x, point.y, hint, hit);
    hint = hit.segment;
    largest = Math.max(largest, hit.distance);
  }
  return largest;
};

const pointAlong = (
  points: readonly GroundPoint[],
  distanceM: number
): GroundPoint => {
  const line = new LmuWorldLine(points);
  const target = ((distanceM % line.lengthM) + line.lengthM) % line.lengthM;
  let index = 0;
  while (index < line.count - 1 && line.cumulative[index + 1] < target) {
    index += 1;
  }
  const from = points[index];
  const to = points[(index + 1) % line.count];
  const span = line.cumulative[index + 1] - line.cumulative[index];
  const amount = span > 0 ? (target - line.cumulative[index]) / span : 0;
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
};

const lapStartShift = (
  reference: WidthCandidate,
  other: WidthCandidate,
  referenceLine: LmuWorldLine
): number => {
  const start = pointAlong(other.world.track.racing, other.world.offsetM);
  const hit: LineHit = { distance: 0, along: 0, segment: -1 };
  referenceLine.project(start.x, start.y, -1, hit);
  const length = referenceLine.lengthM;
  const shift =
    (((hit.along - reference.world.offsetM) % length) + length) % length;
  return Math.min(shift, length - shift);
};

const disagreement = (
  reference: WidthCandidate,
  other: WidthCandidate,
  referenceLine: LmuWorldLine
): string | null => {
  const lapDifference = Math.abs(
    reference.world.lapDistM - other.world.lapDistM
  );
  if (lapDifference > LAP_MATCH_TOLERANCE_M) {
    return `lap distance ${other.world.lapDistM.toFixed(1)} m against ${reference.world.lapDistM.toFixed(1)} m`;
  }
  if (other.width.sign !== reference.width.sign) {
    return 'LMU lateral sign differs';
  }
  const lengthDifference =
    Math.abs(other.world.track.lengthM - reference.world.track.lengthM) /
    reference.world.track.lengthM;
  if (lengthDifference > MAX_LENGTH_DIFFERENCE) {
    return `racing line ${other.world.track.lengthM.toFixed(0)} m against ${reference.world.track.lengthM.toFixed(0)} m`;
  }
  const distance = largestLineDistance(referenceLine, other.world.track.racing);
  if (distance >= MAX_LINE_DISTANCE_M) {
    return `racing line up to ${distance.toFixed(1)} m from the reference`;
  }
  const shift = lapStartShift(reference, other, referenceLine);
  if (shift > LAP_MATCH_TOLERANCE_M) {
    return `lap starts ${shift.toFixed(1)} m from the reference`;
  }
  return null;
};

const mergeWidths = (
  widths: readonly BundledTrackWidth[]
): BundledTrackWidth => {
  const { bins, sign } = widths[0];
  const centreN = new Float64Array(bins);
  const centreX = new Float64Array(bins);
  const centreY = new Float64Array(bins);
  const leftN = new Float64Array(bins);
  const leftSum = new Float64Array(bins);
  const rightN = new Float64Array(bins);
  const rightSum = new Float64Array(bins);
  for (const width of widths) {
    for (let bin = 0; bin < bins; bin += 1) {
      const n = width.centreCount[bin];
      if (n > 0) {
        centreN[bin] += n;
        centreX[bin] += width.centre[bin * 2] * n;
        centreY[bin] += width.centre[bin * 2 + 1] * n;
      }
      if (width.leftCount[bin] > 0) {
        leftN[bin] += width.leftCount[bin];
        leftSum[bin] += width.left[bin] * width.leftCount[bin];
      }
      if (width.rightCount[bin] > 0) {
        rightN[bin] += width.rightCount[bin];
        rightSum[bin] += width.right[bin] * width.rightCount[bin];
      }
    }
  }
  const merged: BundledTrackWidth = {
    bins,
    sign,
    centre: new Array<number>(bins * 2).fill(0),
    left: new Array<number>(bins).fill(0),
    right: new Array<number>(bins).fill(0),
    centreCount: new Array<number>(bins).fill(0),
    leftCount: new Array<number>(bins).fill(0),
    rightCount: new Array<number>(bins).fill(0),
  };
  for (let bin = 0; bin < bins; bin += 1) {
    if (centreN[bin] > 0) {
      merged.centre[bin * 2] = Math.round(centreX[bin] / centreN[bin]);
      merged.centre[bin * 2 + 1] = Math.round(centreY[bin] / centreN[bin]);
      merged.centreCount[bin] = Math.min(MAX_COUNT, Math.round(centreN[bin]));
    }
    if (leftN[bin] > 0) {
      merged.left[bin] = Math.round(leftSum[bin] / leftN[bin]);
      merged.leftCount[bin] = Math.min(MAX_COUNT, Math.round(leftN[bin]));
    }
    if (rightN[bin] > 0) {
      merged.right[bin] = Math.round(rightSum[bin] / rightN[bin]);
      merged.rightCount[bin] = Math.min(MAX_COUNT, Math.round(rightN[bin]));
    }
  }
  return merged;
};

const evaluate = (
  width: BundledTrackWidth,
  line: LmuDrawnLine,
  lapDistM: number
): Evaluation | null => {
  const stored = storedTrackWidthFromBundle(width, line, lapDistM);
  if (!stored) return null;
  const profile = new LmuTrackWidthProfile();
  profile.reset(line, lapDistM);
  if (!profile.seed(stored)) return null;
  const left = new Float64Array(profile.binCount);
  const right = new Float64Array(profile.binCount);
  profile.resolvedEdges(left, right);
  return {
    measured: profile.coverage(),
    smoothed: profile.supportedCoverage(),
    left,
    right,
  };
};

const largestEdgeChange = (before: Evaluation, after: Evaluation): number => {
  let largest = 0;
  const bins = Math.min(before.left.length, after.left.length);
  for (let bin = 0; bin < bins; bin += 1) {
    for (const [a, b] of [
      [before.left[bin], after.left[bin]],
      [before.right[bin], after.right[bin]],
    ]) {
      if (Number.isFinite(a) && Number.isFinite(b)) {
        largest = Math.max(largest, Math.abs(a - b));
      }
    }
  }
  return largest;
};

const centimetres = (points: readonly GroundPoint[]): number[] =>
  points.flatMap((point) => [
    Math.round(point.x * 100),
    Math.round(point.y * 100),
  ]);

const entryJson = (
  reference: Candidate,
  width: BundledTrackWidth | null,
  evaluation: Evaluation | null,
  samples: number,
  files: number,
  options: GeometryExportOptions
): TrackGeometryEntryJson => ({
  lapDistCm: Math.round(reference.world.lapDistM * 100),
  world: {
    racing: centimetres(reference.world.track.racing),
    pitLane: centimetres(reference.world.track.pitLane),
    offsetCm: Math.round(reference.world.offsetM * 100),
  },
  ...(width
    ? {
        width: {
          bins: width.bins,
          sign: width.sign,
          centre: width.centre,
          left: width.left,
          right: width.right,
          centreCount: width.centreCount,
          leftCount: width.leftCount,
          rightCount: width.rightCount,
        },
      }
    : {}),
  stats: {
    measuredCoverage: Math.round((evaluation?.measured ?? 0) * 100),
    smoothedCoverage: Math.round((evaluation?.smoothed ?? 0) * 100),
    samples,
    files,
    createdAt: options.createdAt,
    irdashiesVersion: options.irdashiesVersion,
  },
});

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function sectorBoundariesFromLogs(
  logs: readonly SectorLogInput[]
): Map<string, { boundaries: number[]; readings: number }> {
  const readings = new Map<string, { s2: number[]; s3: number[] }>();
  for (const log of logs) {
    for (const line of log.text.split(/\r?\n/)) {
      const match = SECTOR_LINE.exec(line);
      if (!match) continue;
      const s2 = Number(match[2]);
      const s3 = Number(match[3]);
      if (!parseSectorBoundaries([s2, s3])) continue;
      const trackName = match[1].trim();
      const entry = readings.get(trackName) ?? { s2: [], s3: [] };
      entry.s2.push(s2);
      entry.s3.push(s3);
      readings.set(trackName, entry);
    }
  }
  const factor = 10 ** SECTOR_DECIMALS;
  const result = new Map<string, { boundaries: number[]; readings: number }>();
  for (const [trackName, { s2, s3 }] of readings) {
    const boundaries = [
      Math.round(median(s2) * factor) / factor,
      Math.round(median(s3) * factor) / factor,
    ];
    if (parseSectorBoundaries(boundaries)) {
      result.set(trackName, { boundaries, readings: s2.length });
    }
  }
  return result;
}

const sortedRecord = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]])
  );

export function serializeTrackGeometry(
  bundle: TrackGeometryBundleJson
): string {
  const names = Object.keys(bundle.tracks).sort();
  const sectorNames = Object.keys(bundle.sectors ?? {}).sort();
  const tracks =
    names.length === 0
      ? '{}'
      : `{\n${names
          .map(
            (name) =>
              `${JSON.stringify(name)}:${JSON.stringify(bundle.tracks[name])}`
          )
          .join(',\n')}\n}`;
  if (sectorNames.length === 0) {
    return `{"version":${bundle.version},"tracks":${tracks}}\n`;
  }
  const sectors = `{\n${sectorNames
    .map(
      (name) =>
        `${JSON.stringify(name)}:${JSON.stringify(bundle.sectors?.[name])}`
    )
    .join(',\n')}\n}`;
  return `{"version":${bundle.version},"tracks":${tracks},\n"sectors":${sectors}}\n`;
}

export const unusableExistingBundle = (existing: unknown): string | null => {
  if (existing === undefined) return null;
  if (!isObject(existing)) return 'is not a track geometry bundle';
  if (existing.version !== TRACK_GEOMETRY_BUNDLE_VERSION) {
    return `has version ${String(existing.version)}, which this exporter cannot read (it writes version ${TRACK_GEOMETRY_BUNDLE_VERSION})`;
  }
  return null;
};

const existingSectors = (existing: unknown): Record<string, number[]> => {
  if (
    !isObject(existing) ||
    existing.version !== TRACK_GEOMETRY_BUNDLE_VERSION ||
    !isObject(existing.sectors)
  ) {
    return {};
  }
  const kept: Record<string, number[]> = {};
  for (const [name, value] of Object.entries(existing.sectors)) {
    const boundaries = parseSectorBoundaries(value);
    if (boundaries) kept[name] = boundaries;
  }
  return kept;
};

const existingTracks = (
  existing: unknown,
  report: string[]
): Record<string, TrackGeometryEntryJson> => {
  if (!isObject(existing) || !isObject(existing.tracks)) return {};
  if (existing.version !== TRACK_GEOMETRY_BUNDLE_VERSION) {
    report.push(
      `Existing bundle has version ${String(existing.version)}; starting from an empty one`
    );
    return {};
  }
  const kept: Record<string, TrackGeometryEntryJson> = {};
  for (const [name, entry] of Object.entries(existing.tracks)) {
    if (parseTrackGeometryEntry(entry)) {
      kept[name] = entry as TrackGeometryEntryJson;
    } else {
      report.push(`${name}: existing entry is invalid and was removed`);
    }
  }
  return kept;
};

export function exportLmuTrackGeometry(
  inputs: readonly GeometryInput[],
  existing: unknown,
  options: GeometryExportOptions
): GeometryExportResult {
  const report: string[] = [];
  const accepted: string[] = [];
  const refused: string[] = [];
  const tracks = existingTracks(existing, report);
  const notes = new Map<string, string[]>();
  const byTrack = new Map<string, Candidate[]>();
  for (const input of inputs) {
    if (!isObject(input.data)) {
      report.push(`${input.file}: not a track cache file`);
      continue;
    }
    for (const { trackName, candidate } of candidatesFrom(input, notes)) {
      byTrack.set(trackName, [...(byTrack.get(trackName) ?? []), candidate]);
    }
  }

  const names = [...new Set([...byTrack.keys(), ...notes.keys()])].sort();
  for (const trackName of names) {
    const candidates = [...(byTrack.get(trackName) ?? [])].sort(
      (a, b) => b.samples - a.samples || a.file.localeCompare(b.file)
    );
    const details = [...(notes.get(trackName) ?? [])];
    const refuse = (reason: string) => {
      refused.push(trackName);
      report.push(`${trackName}: refused - ${reason}`);
      for (const detail of details) report.push(`  ${detail}`);
    };
    if (candidates.length === 0) {
      refuse('no usable file');
      continue;
    }
    const widthCandidates = candidates.filter(
      (candidate): candidate is WidthCandidate => candidate.width !== null
    );
    if (widthCandidates.length === 0) {
      const existingEntry = tracks[trackName]
        ? parseTrackGeometryEntry(tracks[trackName])
        : null;
      if (existingEntry?.width) {
        refused.push(trackName);
        report.push(
          `${trackName}: kept the bundled entry with track widths; the new files have only the shape`
        );
        continue;
      }
      const shape = candidates[0];
      const entry = entryJson(shape, null, null, 0, 1, options);
      if (!parseTrackGeometryEntry(entry)) {
        refuse('the shape does not fit its lap length');
        continue;
      }
      tracks[trackName] = entry;
      accepted.push(trackName);
      report.push(
        `${trackName}: ${existingEntry ? 'updated' : 'added'}, shape only, no track width yet (${kilobytes(JSON.stringify(entry).length)})`
      );
      continue;
    }
    const reference = widthCandidates[0];
    const referenceLine = new LmuWorldLine(reference.world.track.racing);
    const agreeing: WidthCandidate[] = [reference];
    for (const other of widthCandidates.slice(1)) {
      const reason = disagreement(reference, other, referenceLine);
      if (reason) details.push(`${other.file}: left out, ${reason}`);
      else agreeing.push(other);
    }
    const bundleBins = bundleBinsFor(reference.world.lapDistM);
    const merged = mergeWidths(
      agreeing.map((candidate) =>
        bundledTrackWidthFromStored(candidate.width, candidate.line, bundleBins)
      )
    );
    const samples = sumOf(agreeing.map((candidate) => candidate.samples));
    const evaluation = evaluate(
      merged,
      reference.line,
      reference.world.lapDistM
    );
    if (!evaluation) {
      refuse('the width does not convert onto its own line');
      continue;
    }
    if (evaluation.smoothed < MIN_SMOOTHED_COVERAGE) {
      refuse(
        `smoothed both-edge coverage ${percent(evaluation.smoothed)} is under ${percent(MIN_SMOOTHED_COVERAGE)}`
      );
      continue;
    }
    if (evaluation.measured < MIN_MEASURED_COVERAGE) {
      refuse(
        `measured both-sided coverage ${percent(evaluation.measured)} is under ${percent(MIN_MEASURED_COVERAGE)}`
      );
      continue;
    }
    if (samples < MIN_SAMPLES) {
      refuse(`${samples} samples, under ${MIN_SAMPLES}`);
      continue;
    }

    const entry = entryJson(
      reference,
      merged,
      evaluation,
      samples,
      agreeing.length,
      options
    );
    const previous = tracks[trackName]
      ? parseTrackGeometryEntry(tracks[trackName])
      : null;
    const before = previous?.width
      ? evaluate(previous.width.width, reference.line, reference.world.lapDistM)
      : null;
    const change = previous
      ? before
        ? `updated, largest edge change ${largestEdgeChange(before, evaluation).toFixed(1)} m`
        : previous.width
          ? 'updated, previous entry does not fit the new line'
          : 'updated with track widths'
      : 'added';
    tracks[trackName] = entry;
    accepted.push(trackName);
    report.push(
      `${trackName}: ${change} (${agreeing.length} file${agreeing.length === 1 ? '' : 's'}, ${samples} samples, ${percent(evaluation.measured)} measured / ${percent(evaluation.smoothed)} smoothed with both edges, ${kilobytes(JSON.stringify(entry).length)})`
    );
    for (const detail of details) report.push(`  ${detail}`);
  }

  const sectors = existingSectors(existing);
  for (const [trackName, { boundaries, readings }] of sectorBoundariesFromLogs(
    options.sectorLogs ?? []
  )) {
    const previous = sectors[trackName];
    sectors[trackName] = boundaries;
    report.push(
      `${trackName}: sectors S2 ${boundaries[0].toFixed(SECTOR_DECIMALS)}, S3 ${boundaries[1].toFixed(SECTOR_DECIMALS)} (median of ${readings} reading${readings === 1 ? '' : 's'}${previous ? `, was S2 ${previous[0].toFixed(SECTOR_DECIMALS)}, S3 ${previous[1].toFixed(SECTOR_DECIMALS)}` : ''})`
    );
  }

  const sectorCount = Object.keys(sectors).length;
  const bundle: TrackGeometryBundleJson = {
    version: TRACK_GEOMETRY_BUNDLE_VERSION,
    tracks,
    ...(sectorCount > 0 ? { sectors: sortedRecord(sectors) } : {}),
  };
  const text = serializeTrackGeometry(bundle);
  report.push(
    `Bundle: ${Object.keys(tracks).length} track${Object.keys(tracks).length === 1 ? '' : 's'}, sector boundaries for ${sectorCount} track${sectorCount === 1 ? '' : 's'}, ${kilobytes(text.length)}`
  );
  return { bundle, text, report, accepted, refused };
}
