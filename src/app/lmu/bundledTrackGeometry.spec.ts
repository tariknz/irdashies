import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultLmuTrackGeometry,
  LmuBundledTrackGeometry,
  parseSectorBoundaries,
  parseTrackGeometryEntry,
  TRACK_GEOMETRY_BUNDLE_VERSION,
  type TrackGeometryEntryJson,
} from './bundledTrackGeometry';
import {
  FIXTURE_LAP_M as LAP,
  fixtureDrawnLine as drawnLineOf,
  fixtureRacingLine as racingLine,
  fixtureStoredWidth as storedFor,
} from './trackGeometryFixture';
import {
  bundleBinsFor,
  bundledTrackWidthFromStored,
  LmuDrawnLine,
  LmuTrackWidthProfile,
  storedTrackWidthFromBundle,
  type StoredTrackWidth,
} from './trackWidth';
import type { GroundPoint, LmuWorldTrack } from './worldTrack';

const worldEdges = (stored: StoredTrackWidth, line: LmuDrawnLine) => {
  const profile = new LmuTrackWidthProfile();
  profile.reset(line, LAP);
  expect(profile.seed(stored)).toBe(true);
  const left = new Float64Array(profile.binCount);
  const right = new Float64Array(profile.binCount);
  profile.resolvedEdges(left, right);
  const point = { x: 0, y: 0 };
  const toWorld = (offsets: Float64Array) =>
    Array.from(offsets, (offset, bin) => {
      line.pointAt((bin + 0.5) / offsets.length, offset, point);
      return { x: point.x, y: point.y };
    });
  return { left: toWorld(left), right: toWorld(right) };
};

const distanceToPolyline = (point: GroundPoint, line: GroundPoint[]) => {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < line.length; index += 1) {
    const from = line[index];
    const to = line[(index + 1) % line.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    const amount =
      lengthSq > 0
        ? Math.min(
            1,
            Math.max(
              0,
              ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq
            )
          )
        : 0;
    best = Math.min(
      best,
      Math.hypot(from.x + dx * amount - point.x, from.y + dy * amount - point.y)
    );
  }
  return best;
};

const entryFor = (
  track: LmuWorldTrack,
  stored: StoredTrackWidth,
  line: LmuDrawnLine
): TrackGeometryEntryJson => ({
  lapDistCm: Math.round(LAP * 100),
  world: {
    racing: track.racing.flatMap((point) => [
      Math.round(point.x * 100),
      Math.round(point.y * 100),
    ]),
    pitLane: [],
    offsetCm: 0,
  },
  width: bundledTrackWidthFromStored(stored, line, bundleBinsFor(LAP)),
  stats: {
    measuredCoverage: 40,
    smoothedCoverage: 92,
    samples: 5000,
    files: 1,
    createdAt: '2026-11-22',
    irdashiesVersion: '3.0.0',
  },
});

describe('bundled track width format', () => {
  const learnedTrack = racingLine();
  const learnedLine = drawnLineOf(learnedTrack);
  const learned = storedFor(learnedLine);
  const angle = (0.4 * Math.PI) / 180;
  const otherLine = drawnLineOf(
    racingLine((point) => ({
      x: point.x * Math.cos(angle) - point.y * Math.sin(angle) + 1.2,
      y: point.x * Math.sin(angle) + point.y * Math.cos(angle) - 0.8,
    }))
  );

  it('draws the same edges against another line, within 0.2 m', () => {
    const bundled = bundledTrackWidthFromStored(
      learned,
      learnedLine,
      bundleBinsFor(LAP)
    );
    const converted = storedTrackWidthFromBundle(bundled, otherLine, LAP);
    expect(converted).not.toBeNull();
    if (!converted) return;

    const before = worldEdges(learned, learnedLine);
    const after = worldEdges(converted, otherLine);
    for (const side of ['left', 'right'] as const) {
      let worst = 0;
      for (let bin = 0; bin < after[side].length; bin += 7) {
        worst = Math.max(
          worst,
          distanceToPolyline(after[side][bin], before[side])
        );
      }
      expect(worst).toBeLessThan(0.2);
    }
  });

  it('keeps the counts it was learned with, at 4 m', () => {
    const bundled = bundledTrackWidthFromStored(
      learned,
      learnedLine,
      bundleBinsFor(LAP)
    );

    expect(bundled.bins).toBe(Math.round(LAP / 4));
    expect(bundled.centre).toHaveLength(bundled.bins * 2);
    const total = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0);
    expect(total(bundled.centreCount)).toBe(total(learned.centreCount));
    expect(total(bundled.leftCount)).toBe(total(learned.leftCount));
    expect(bundled.centre.every(Number.isInteger)).toBe(true);
  });
});

describe('LmuBundledTrackGeometry', () => {
  const track = racingLine();
  const line = drawnLineOf(track);
  const entry = entryFor(track, storedFor(line), line);

  it('gives the world track and width of a matching lap', () => {
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: { 'Test Oval': entry },
    });

    expect(geometry.size).toBe(1);
    const world = geometry.worldTrack('Test Oval', LAP);
    expect(world?.track.racing).toHaveLength(track.racing.length);
    expect(world?.offsetM).toBe(0);
    expect(geometry.worldTrack('Test Oval', 0)).not.toBeNull();
    const width = geometry.trackWidth('Test Oval', LAP + 1.5);
    expect(width?.samples).toBe(5000);
    expect(width?.smoothedCoverage).toBeCloseTo(0.92);
    expect(width?.irdashiesVersion).toBe('3.0.0');
  });

  it('gives a width only for its own lap length, and nothing for another track', () => {
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: { 'Test Oval': entry },
    });

    expect(geometry.trackWidth('Test Oval', LAP - 5)).toBeNull();
    expect(geometry.worldTrack('Other Track', LAP)).toBeNull();
  });

  it('gives the world track for a lap a little off, but not for another layout length', () => {
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: { 'Test Oval': entry },
    });

    expect(geometry.worldTrack('Test Oval', LAP + 5)).not.toBeNull();
    expect(geometry.worldTrack('Test Oval', LAP * 1.2)).toBeNull();
  });

  it('stretches by the bundled lap, not by the length of its racing line', () => {
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: {
        'Test Oval': { ...entry, lapDistCm: Math.round(LAP * 1.04 * 100) },
      },
    });

    expect(geometry.worldTrack('Test Oval', LAP * 1.08)).not.toBeNull();
    expect(geometry.worldTrack('Test Oval', LAP * 0.995)).not.toBeNull();
    expect(geometry.worldTrack('Test Oval', LAP * 0.97)).toBeNull();
  });

  it('finds a track whatever its case and spacing', () => {
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: { 'Test Oval': entry },
      sectors: { 'Test Oval': [0.3, 0.6] },
    });

    expect(geometry.worldTrack('  test   OVAL ', LAP)).not.toBeNull();
    expect(geometry.trackWidth('TEST OVAL', LAP)).not.toBeNull();
    expect(geometry.sectorBoundaries('test oval')).toEqual([0.3, 0.6]);
    expect(geometry.has('Test  Oval')).toBe(true);
  });

  it('gives bundled sectors only for a lap the bundled layout fits', () => {
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: { 'Test Oval': entry },
      sectors: { 'Test Oval': [0.3, 0.6], 'Shape Unknown': [0.4, 0.7] },
    });

    expect(geometry.sectorBoundaries('Test Oval', LAP)).toEqual([0.3, 0.6]);
    expect(geometry.sectorBoundaries('Test Oval', LAP * 1.03)).toEqual([
      0.3, 0.6,
    ]);
    expect(geometry.sectorBoundaries('Test Oval', LAP * 1.2)).toBeNull();
    expect(geometry.sectorBoundaries('Test Oval')).toEqual([0.3, 0.6]);
    expect(geometry.sectorBoundaries('Shape Unknown', 5000)).toEqual([
      0.4, 0.7,
    ]);
  });

  it('skips an entry that does not parse, and a bundle of another version', () => {
    const broken = { ...entry, width: { ...entry.width, left: [1, 2] } };
    expect(parseTrackGeometryEntry(broken)).toBeNull();
    expect(
      new LmuBundledTrackGeometry({
        version: TRACK_GEOMETRY_BUNDLE_VERSION,
        tracks: { 'Test Oval': broken, Fine: entry },
      }).size
    ).toBe(1);
    expect(
      new LmuBundledTrackGeometry({ version: 99, tracks: { Fine: entry } }).size
    ).toBe(0);
    expect(new LmuBundledTrackGeometry(null).size).toBe(0);
  });

  it('gives the shape of an entry that has no width yet', () => {
    const shapeOnly: TrackGeometryEntryJson = { ...entry };
    delete shapeOnly.width;
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: { 'Test Oval': shapeOnly },
    });

    expect(geometry.size).toBe(1);
    expect(geometry.worldTrack('Test Oval', LAP)).not.toBeNull();
    expect(geometry.trackWidth('Test Oval', LAP)).toBeNull();
  });

  it('gives sector boundaries by track name, skipping implausible ones', () => {
    const geometry = new LmuBundledTrackGeometry({
      version: TRACK_GEOMETRY_BUNDLE_VERSION,
      tracks: {},
      sectors: {
        'Paul Ricard - ELMS': [0.2747, 0.6028],
        Backwards: [0.6, 0.5],
        TooClose: [0.5, 0.51],
        Short: [0.5],
      },
    });

    expect(geometry.sectorBoundaries('Paul Ricard - ELMS')).toEqual([
      0.2747, 0.6028,
    ]);
    expect(geometry.sectorCount).toBe(1);
    expect(geometry.sectorBoundaries('Backwards')).toBeNull();
    expect(geometry.sectorBoundaries('Unknown')).toBeNull();
    expect(parseSectorBoundaries([0.01, 0.5])).toBeNull();
  });

  it('ships the recorded tracks, each width for its own lap length only', () => {
    const geometry = defaultLmuTrackGeometry();

    expect(geometry.size).toBe(34);
    expect(
      geometry.trackWidth('Algarve International Circuit', 4635.3)
    ).not.toBeNull();
    expect(geometry.trackWidth('Algarve International Circuit', 4600)).toBe(
      null
    );
    expect(
      geometry.worldTrack('Algarve International Circuit', 4600)
    ).not.toBeNull();
    expect(geometry.worldTrack('Algarve International Circuit', 4000)).toBe(
      null
    );
    expect(
      geometry.trackWidth('Autodromo Nazionale Monza', 5780.6)
    ).not.toBeNull();
    expect(geometry.trackWidth('Autodromo Nazionale Monza', 5793)).toBe(null);
    expect(
      geometry.trackWidth('Autódromo José Carlos Pace', 4273.2)
    ).not.toBeNull();
    expect(geometry.trackWidth('Circuit de la Sarthe', 13624)).not.toBeNull();
    expect(
      geometry.trackWidth('Circuit de la Sarthe Mulsanne', 13560.9)
    ).not.toBeNull();
    expect(geometry.trackWidth('Circuit de la Sarthe Mulsanne', 13624)).toBe(
      null
    );
    expect(
      geometry.trackWidth('Daytona International Speedway Road Course', 5729)
    ).toBeNull();
    expect(
      geometry.trackWidth('Circuit de Spa-Francorchamps', 6981.6)
    ).not.toBeNull();
    expect(
      geometry.trackWidth('Bahrain Endurance Circuit', 6256.9)
    ).not.toBeNull();
    expect(geometry.worldTrack('Bahrain International Circuit', 6256.9)).toBe(
      null
    );
    expect(
      geometry.trackWidth('Silverstone Grand Prix Circuit - WEC', 5869.2)
    ).not.toBeNull();
    expect(
      geometry.trackWidth('Sebring International Raceway', 5820.3)
    ).not.toBeNull();
  });

  it('ships sector boundaries for every bundled track', () => {
    const geometry = defaultLmuTrackGeometry();

    expect(geometry.sectorCount).toBe(34);
    expect(geometry.sectorBoundaries('Paul Ricard - 1A')).toEqual([
      0.2725, 0.5975,
    ]);
    expect(geometry.sectorBoundaries('Circuit de Barcelona')).toEqual([
      0.3509, 0.7204,
    ]);
    expect(geometry.sectorBoundaries('Paul Ricard - ELMS')).toEqual([
      0.2747, 0.6028,
    ]);
    expect(
      geometry.sectorBoundaries('Autodromo Enzo e Dino Ferrari')
    ).not.toBeNull();
    expect(geometry.sectorBoundaries('Circuit de la Sarthe')).toEqual([
      0.1392, 0.567,
    ]);
    expect(geometry.sectorBoundaries('Circuit de la Sarthe Mulsanne')).toEqual([
      0.1398, 0.565,
    ]);
  });

  it('stays under 3 MB', () => {
    const file = path.join(
      process.cwd(),
      'src',
      'app',
      'lmu',
      'lmu-track-geometry.json'
    );

    expect(fs.statSync(file).size).toBeLessThan(3 * 1024 * 1024);
  });
});
