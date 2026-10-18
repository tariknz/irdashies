import { describe, expect, it } from 'vitest';
import {
  RADAR_POLE_SIDES,
  parseRadarPoleSides,
  poleLeftForTrack,
} from './radarPoleSides';

describe('radarPoleSides.json', () => {
  it('is well formed: nothing is dropped when parsed', () => {
    const raw = JSON.parse(
      JSON.stringify(RADAR_POLE_SIDES)
    ) as typeof RADAR_POLE_SIDES;
    expect(parseRadarPoleSides(raw)).toEqual(RADAR_POLE_SIDES);
    expect(Object.keys(RADAR_POLE_SIDES.tracks).length).toBeGreaterThan(100);
  });

  it('keeps the sides confirmed by driving', () => {
    const verified = Object.entries(RADAR_POLE_SIDES.tracks)
      .filter(([, entry]) => entry.source === 'verified')
      .map(([id, entry]) => [id, entry.poleLeft]);
    expect(verified).toEqual(
      expect.arrayContaining([
        ['95', true],
        ['212', true],
        ['353', false],
        ['434', false],
      ])
    );
    expect(RADAR_POLE_SIDES.trackNames.longbeach).toBe(true);
  });
});

describe('parseRadarPoleSides', () => {
  it.each([null, undefined, 3, 'x', { version: 2, tracks: {} }])(
    'gives an empty table for %j',
    (raw) => {
      expect(parseRadarPoleSides(raw)).toEqual({
        version: 1,
        tracks: {},
        trackNames: {},
      });
    }
  );

  it('drops malformed entries and keeps the good ones', () => {
    const parsed = parseRadarPoleSides({
      version: 1,
      tracks: {
        '1': { poleLeft: true, source: 'geometry' },
        abc: { poleLeft: true, source: 'geometry' },
        '2': { poleLeft: 'yes', source: 'geometry' },
        '3': { poleLeft: false, source: 'guess' },
        '4': null,
      },
      trackNames: { a: true, b: 'left' },
    });
    expect(parsed.tracks).toEqual({
      '1': { poleLeft: true, source: 'geometry' },
    });
    expect(parsed.trackNames).toEqual({ a: true });
  });
});

describe('poleLeftForTrack', () => {
  const sides = parseRadarPoleSides({
    version: 1,
    tracks: { '7': { poleLeft: false, source: 'geometry' } },
    trackNames: { oddtrack: true, toString: true },
  });

  it('lets a track name override the id', () => {
    expect(poleLeftForTrack(7, 'oddtrack', sides)).toBe(true);
  });

  it('falls back to the id, then to nothing', () => {
    expect(poleLeftForTrack(7, 'other', sides)).toBe(false);
    expect(poleLeftForTrack(8, 'other', sides)).toBeUndefined();
    expect(poleLeftForTrack(undefined, undefined, sides)).toBeUndefined();
  });

  it('does not read inherited object keys as track names', () => {
    expect(poleLeftForTrack(undefined, 'constructor', sides)).toBeUndefined();
  });
});
