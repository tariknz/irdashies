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
        ['444', false],
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
        '3': { poleLeft: false },
        '4': null,
      },
      trackNames: { a: true, b: 'left' },
    });
    expect(parsed.tracks).toEqual({
      '1': { poleLeft: true, source: 'geometry' },
    });
    expect(parsed.trackNames).toEqual({ a: true });
  });

  it('keeps the name and iRacing hints when well formed', () => {
    const parsed = parseRadarPoleSides({
      version: 1,
      tracks: {
        '1': {
          poleLeft: true,
          source: 'geometry',
          name: 'Sebring - International',
          iracing: { start: true, restart: false },
        },
        '2': {
          poleLeft: false,
          source: 'geometry',
          name: 42,
          iracing: { start: true },
        },
        '3': {
          poleLeft: false,
          source: 'geometry',
          name: 'x'.repeat(500),
        },
      },
    });
    expect(parsed.tracks['1']).toEqual({
      poleLeft: true,
      source: 'geometry',
      name: 'Sebring - International',
      iracing: { start: true, restart: false },
    });
    expect(parsed.tracks['2']).toEqual({ poleLeft: false, source: 'geometry' });
    expect(parsed.tracks['3']).toEqual({ poleLeft: false, source: 'geometry' });
  });

  it('reads a source it does not know as geometry, not as a missing entry', () => {
    const parsed = parseRadarPoleSides({
      version: 1,
      tracks: {
        '5': { poleLeft: true, source: 'crowd' },
        '6': { poleLeft: false, source: 'reported' },
      },
    });
    expect(parsed.tracks).toEqual({
      '5': { poleLeft: true, source: 'geometry' },
      '6': { poleLeft: false, source: 'reported' },
    });
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
