import { describe, expect, it } from 'vitest';
import { LmuBundledTrackGeometry } from '../src/app/lmu/bundledTrackGeometry';
import {
  FIXTURE_LAP_M,
  fixtureCacheEntry,
  fixtureDrawnLine,
  fixtureRacingLine,
  fixtureStoredWidth,
  type FixtureWidthOptions,
} from '../src/app/lmu/trackGeometryFixture';
import {
  exportLmuTrackGeometry,
  sectorBoundariesFromLogs,
} from './lmu-track-geometry';

const options = { createdAt: '2026-11-22', irdashiesVersion: '3.0.0' };

const track = fixtureRacingLine();
const line = fixtureDrawnLine(track);

const cacheFile = (
  file: string,
  widthOptions: FixtureWidthOptions = {},
  trackName = 'Test Oval',
  sourceTrack = track
) => ({
  file,
  data: {
    [trackName]: fixtureCacheEntry(
      sourceTrack,
      fixtureStoredWidth(
        sourceTrack === track ? line : fixtureDrawnLine(sourceTrack),
        widthOptions
      )
    ),
  },
});

describe('exportLmuTrackGeometry', () => {
  it('adds a track that passes every gate', () => {
    const result = exportLmuTrackGeometry(
      [cacheFile('a.json')],
      undefined,
      options
    );

    expect(result.accepted).toEqual(['Test Oval']);
    const entry = result.bundle.tracks['Test Oval'];
    expect(entry.lapDistCm).toBe(Math.round(FIXTURE_LAP_M * 100));
    expect(entry.stats).toMatchObject({
      measuredCoverage: 100,
      smoothedCoverage: 100,
      files: 1,
      createdAt: '2026-11-22',
      irdashiesVersion: '3.0.0',
    });
    expect(result.report[0]).toMatch(
      /^Test Oval: added \(1 file, \d+ samples, 100% measured \/ 100% smoothed with both edges, \d+ KB\)$/
    );

    const geometry = new LmuBundledTrackGeometry(JSON.parse(result.text));
    expect(geometry.worldTrack('Test Oval', FIXTURE_LAP_M)).not.toBeNull();
    expect(geometry.trackWidth('Test Oval', FIXTURE_LAP_M)).not.toBeNull();
  });

  it('refuses a track with too little of the lap smoothed on both sides', () => {
    const gap = (_bin: number, pct: number) => (pct < 0.25 ? 0 : 30);
    const result = exportLmuTrackGeometry(
      [
        cacheFile('a.json', {
          centreCount: gap,
          leftCount: gap,
          rightCount: gap,
        }),
      ],
      undefined,
      options
    );

    expect(result.refused).toEqual(['Test Oval']);
    expect(result.report[0]).toMatch(
      /^Test Oval: refused - smoothed both-edge coverage \d+% is under 85%$/
    );
  });

  it('refuses a track whose far edges are mostly mirrored', () => {
    const result = exportLmuTrackGeometry(
      [cacheFile('a.json', { leftCount: (bin) => (bin % 12 === 0 ? 30 : 0) })],
      undefined,
      options
    );

    expect(result.refused).toEqual(['Test Oval']);
    expect(result.report[0]).toMatch(
      /^Test Oval: refused - measured both-sided coverage \d+% is under 20%$/
    );
  });

  it('refuses a track with too few samples', () => {
    const one = () => 1;
    const result = exportLmuTrackGeometry(
      [
        cacheFile('a.json', {
          centreCount: one,
          leftCount: one,
          rightCount: one,
        }),
      ],
      undefined,
      options
    );

    expect(result.refused).toEqual(['Test Oval']);
    expect(result.report[0]).toMatch(
      /^Test Oval: refused - \d+ samples, under 2000$/
    );
  });

  it('adds a track without a usable width as its shape only', () => {
    const entry = fixtureCacheEntry(track, fixtureStoredWidth(line));
    const result = exportLmuTrackGeometry(
      [
        {
          file: 'a.json',
          data: { 'Test Oval': { ...entry, width: { version: 1 } } },
        },
      ],
      undefined,
      options
    );

    expect(result.accepted).toEqual(['Test Oval']);
    expect(result.report[0]).toMatch(
      /^Test Oval: added, shape only, no track width yet \(\d+ KB\)$/
    );
    expect(result.bundle.tracks['Test Oval'].width).toBeUndefined();
    const geometry = new LmuBundledTrackGeometry(JSON.parse(result.text));
    expect(geometry.worldTrack('Test Oval', FIXTURE_LAP_M)).not.toBeNull();
    expect(geometry.trackWidth('Test Oval', FIXTURE_LAP_M)).toBeNull();
  });

  it('keeps a bundled entry with widths over a file with only the shape', () => {
    const committed = exportLmuTrackGeometry(
      [cacheFile('a.json')],
      undefined,
      options
    );
    const entry = fixtureCacheEntry(track, fixtureStoredWidth(line));
    const result = exportLmuTrackGeometry(
      [{ file: 'b.json', data: { 'Test Oval': { ...entry, width: null } } }],
      JSON.parse(committed.text),
      options
    );

    expect(result.report[0]).toBe(
      'Test Oval: kept the bundled entry with track widths; the new files have only the shape'
    );
    expect(result.bundle.tracks['Test Oval'].width).toBeDefined();
  });

  it('takes each track sector boundaries from logs, as the median', () => {
    const log = [
      '[info]  [lmuSdkBridge] Learned sector boundaries for Test Oval: S2 0.2470, S3 0.5569',
      '[info]  [lmuSdkBridge] Learned sector boundaries for Test Oval: S2 0.2473, S3 0.5568',
      '[info]  [lmuSdkBridge] Learned sector boundaries for Test Oval: S2 0.2471, S3 0.5569',
      '[info]  [lmuSdkBridge] Learned sector boundaries for Autódromo José Carlos Pace: S2 0.3041, S3 0.7444',
      '[info]  [lmuSdkBridge] Learned sector boundaries for Broken: S2 0.6000, S3 0.5000',
      '[info]  [lmuSdkBridge] Track Test Oval; map loaded (bundled)',
    ].join('\r\n');
    const boundaries = sectorBoundariesFromLogs([
      { file: 'main.log', text: log },
    ]);

    expect(boundaries.get('Test Oval')).toEqual({
      boundaries: [0.2471, 0.5569],
      readings: 3,
    });
    expect(boundaries.get('Autódromo José Carlos Pace')?.boundaries).toEqual([
      0.3041, 0.7444,
    ]);
    expect(boundaries.has('Broken')).toBe(false);
  });

  it('bundles sector boundaries, also for tracks without a shape', () => {
    const committed = exportLmuTrackGeometry([], undefined, {
      ...options,
      sectorLogs: [
        {
          file: 'old.log',
          text: 'Learned sector boundaries for Kept Track: S2 0.3000, S3 0.6000',
        },
      ],
    });
    const result = exportLmuTrackGeometry(
      [cacheFile('a.json')],
      JSON.parse(committed.text),
      {
        ...options,
        sectorLogs: [
          {
            file: 'main.log',
            text: 'Learned sector boundaries for Paul Ricard - ELMS: S2 0.2747, S3 0.6028',
          },
        ],
      }
    );

    expect(result.report).toContain(
      'Paul Ricard - ELMS: sectors S2 0.2747, S3 0.6028 (median of 1 reading)'
    );
    expect(result.report.at(-1)).toMatch(
      /^Bundle: 1 track, sector boundaries for 2 tracks, \d+ KB$/
    );
    const geometry = new LmuBundledTrackGeometry(JSON.parse(result.text));
    expect(geometry.sectorBoundaries('Paul Ricard - ELMS')).toEqual([
      0.2747, 0.6028,
    ]);
    expect(geometry.sectorBoundaries('Kept Track')).toEqual([0.3, 0.6]);
    expect(geometry.sectorBoundaries('Test Oval')).toBeNull();
  });

  it('merges two files that agree, adding their weights', () => {
    const result = exportLmuTrackGeometry(
      [cacheFile('a.json'), cacheFile('b.json')],
      undefined,
      options
    );
    const single = exportLmuTrackGeometry(
      [cacheFile('a.json')],
      undefined,
      options
    );

    const merged = result.bundle.tracks['Test Oval'];
    const alone = single.bundle.tracks['Test Oval'];
    expect(merged.stats.files).toBe(2);
    expect(merged.stats.samples).toBe(alone.stats.samples * 2);
    expect(merged.width?.centreCount[10]).toBe(
      (alone.width?.centreCount[10] ?? 0) * 2
    );
    expect(merged.width?.left).toEqual(alone.width?.left);
  });

  it('leaves out a file that disagrees, and says why', () => {
    const shifted = fixtureRacingLine((point) => ({
      x: point.x + 3,
      y: point.y,
    }));
    const result = exportLmuTrackGeometry(
      [
        cacheFile('a.json', {}, 'Test Oval', track),
        cacheFile('b.json', { centreCount: () => 10 }, 'Test Oval', shifted),
      ],
      undefined,
      options
    );

    expect(result.accepted).toEqual(['Test Oval']);
    expect(result.bundle.tracks['Test Oval'].stats.files).toBe(1);
    expect(result.report).toContainEqual(
      expect.stringMatching(
        /^ {2}b\.json: left out, racing line up to 3\.0 m from the reference$/
      )
    );
  });

  it('writes the same bytes for the same input', () => {
    const first = exportLmuTrackGeometry(
      [cacheFile('a.json')],
      undefined,
      options
    );
    const second = exportLmuTrackGeometry(
      [cacheFile('a.json')],
      undefined,
      options
    );

    expect(second.text).toBe(first.text);
    expect(first.text.endsWith('\n')).toBe(true);
  });

  it('reports the change against the committed bundle and keeps other tracks', () => {
    const committed = exportLmuTrackGeometry(
      [cacheFile('a.json', {}, 'Other Oval'), cacheFile('a.json')],
      undefined,
      options
    );
    const result = exportLmuTrackGeometry(
      [cacheFile('b.json')],
      JSON.parse(committed.text),
      options
    );

    expect(result.report[0]).toMatch(
      /^Test Oval: updated, largest edge change 0\.0 m \(1 file/
    );
    expect(Object.keys(result.bundle.tracks)).toEqual([
      'Other Oval',
      'Test Oval',
    ]);
  });

  it('writes an empty bundle when nothing passes', () => {
    const result = exportLmuTrackGeometry([], undefined, options);

    expect(result.text).toBe('{"version":1,"tracks":{}}\n');
  });
});
