import { describe, expect, it } from 'vitest';
import { parseTrackGeometryEntry } from '../src/app/lmu/bundledTrackGeometry';
import {
  FIXTURE_LAP_M,
  fixtureCacheEntry,
  fixtureDrawnLine,
  fixtureRacingLine,
  fixtureStoredWidth,
} from '../src/app/lmu/trackGeometryFixture';
import { exportLmuTrackGeometry } from './lmu-track-geometry';
import {
  FALLBACK_ROAD_WIDTH_M,
  renderLmuTrackSvg,
  trackSvgFileName,
} from './lmu-track-svg';

const track = fixtureRacingLine();
const line = fixtureDrawnLine(track);
const options = { createdAt: '2026-11-23', irdashiesVersion: '3.0.0' };

const geometryFor = (withWidth: boolean) => {
  const entry = fixtureCacheEntry(track, fixtureStoredWidth(line));
  const { bundle } = exportLmuTrackGeometry(
    [
      {
        file: 'a.json',
        data: {
          'Test & Oval': withWidth ? entry : { ...entry, width: null },
        },
      },
    ],
    undefined,
    options
  );
  const geometry = parseTrackGeometryEntry(bundle.tracks['Test & Oval']);
  if (!geometry) throw new Error('fixture does not parse');
  return geometry;
};

const geometryWithGap = () => {
  const gap = (bin: number) => (bin >= 300 && bin < 480 ? 0 : 30);
  const entry = fixtureCacheEntry(
    track,
    fixtureStoredWidth(line, {
      centreCount: gap,
      leftCount: gap,
      rightCount: gap,
    })
  );
  const { bundle } = exportLmuTrackGeometry(
    [{ file: 'a.json', data: { 'Test Oval': entry } }],
    undefined,
    options
  );
  const geometry = parseTrackGeometryEntry(bundle.tracks['Test Oval']);
  if (!geometry) throw new Error('fixture does not parse');
  return geometry;
};

const roadPointCount = (svg: string): number => {
  const road = /<path d="([^"]*)" fill="#334155" fill-rule="evenodd"/.exec(svg);
  return road ? (road[1].match(/[ML]/g)?.length ?? 0) : 0;
};

const turns = [
  { number: 1, name: 'First', marker: 0.1 },
  { number: 2, marker: 0.1 },
  { number: 3, name: 'Turn 3', start: 0.95, end: 0.05 },
];

describe('renderLmuTrackSvg', () => {
  it('draws the road between its learned edges, with sectors and corners', () => {
    const result = renderLmuTrackSvg({
      trackName: 'Test & Oval',
      geometry: geometryFor(true),
      sectors: [0.3, 0.6],
      turns,
    });

    expect(result.hasWidth).toBe(true);
    expect(result.unknownBins).toBe(0);
    expect(result.medianWidthM).toBeGreaterThan(8);
    expect(result.labels).toBe(3);
    expect(
      result.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')
    ).toBe(true);
    expect(result.svg).toContain('<title>Test &amp; Oval</title>');
    expect(result.svg).toContain('fill-rule="evenodd"');
    expect(result.svg.match(/stroke="#fbbf24" stroke-width/g)).toHaveLength(3);
    expect(result.svg).toContain('>T1 First<');
    expect(result.svg).toContain('>T3<');
    expect(result.svg).toContain(`${Math.round(FIXTURE_LAP_M)} m`);
  });

  it('draws an unknown stretch at the fixed width instead of cutting across it', () => {
    const full = renderLmuTrackSvg({
      trackName: 'Test Oval',
      geometry: geometryFor(true),
    });
    const gapped = renderLmuTrackSvg({
      trackName: 'Test Oval',
      geometry: geometryWithGap(),
    });

    expect(gapped.hasWidth).toBe(true);
    expect(gapped.unknownBins).toBeGreaterThan(0);
    expect(roadPointCount(gapped.svg)).toBe(roadPointCount(full.svg));
  });

  it('keeps corner labels that share a spot from overlapping', () => {
    const result = renderLmuTrackSvg({
      trackName: 'Test & Oval',
      geometry: geometryFor(true),
      turns,
    });
    const positions = [
      ...result.svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" class="label"/g),
    ].map((match) => `${match[1]},${match[2]}`);

    expect(new Set(positions).size).toBe(positions.length);
  });

  it('draws a fixed-width road for a track with only its shape', () => {
    const result = renderLmuTrackSvg({
      trackName: 'Test & Oval',
      geometry: geometryFor(false),
    });

    expect(result.hasWidth).toBe(false);
    expect(result.medianWidthM).toBeNull();
    expect(result.svg).toContain(`stroke-width="${FALLBACK_ROAD_WIDTH_M}"`);
    expect(result.svg).toContain('no learned width yet');
    expect(result.svg).not.toContain('yellow: sectors');
  });

  it('keeps the sim handedness: x right, LMU -z down the page', () => {
    const result = renderLmuTrackSvg({
      trackName: 'Test & Oval',
      geometry: geometryFor(true),
    });
    const racing = result.svg.match(
      /<path d="(M[^"]+)" fill="none" stroke="#64748b"/
    );
    expect(racing).not.toBeNull();
    const points = [
      ...(racing?.[1] ?? '').matchAll(/[ML]([\d.-]+),([\d.-]+)/g),
    ].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
    let svgArea = 0;
    let worldArea = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      svgArea += a.x * b.y - b.x * a.y;
      const p = track.racing[index];
      const q = track.racing[(index + 1) % track.racing.length];
      worldArea += p.x * q.y - q.x * p.y;
    }

    expect(Math.sign(svgArea)).toBe(Math.sign(worldArea));
  });
});

describe('trackSvgFileName', () => {
  it('makes a plain file name from an accented track name', () => {
    expect(trackSvgFileName('Autódromo José Carlos Pace')).toBe(
      'autodromo-jose-carlos-pace.svg'
    );
    expect(trackSvgFileName('Paul Ricard - 1A-V2-Short')).toBe(
      'paul-ricard-1a-v2-short.svg'
    );
    expect(trackSvgFileName('***')).toBe('track.svg');
  });
});
