import { describe, expect, it } from 'vitest';
import { parseRaceosPlayer, parseRaceosPlayers, steamIdOf } from './parse';

const player = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Jean Dupont',
  username: 'jdupont',
  driverRank: { rank: 'Gold', tier: 3, progress: 0.42 },
  safetyRank: { rank: 'Silver', tier: 1, progress: 0.1 },
  platforms: [{ id: '76561198000000001', platform: 'steam' }],
  profile: { nationality: 'FRA', badge: 'lemans-2024' },
  ...over,
});

describe('steamIdOf', () => {
  it('picks the steam platform out of the list', () => {
    expect(
      steamIdOf(
        player({
          platforms: [
            { id: 'epic-123', platform: 'epic' },
            { id: '765611980000', platform: 'Steam' },
          ],
        })
      )
    ).toBe('765611980000');
  });

  it('returns undefined when no steam platform is present', () => {
    expect(steamIdOf(player({ platforms: [] }))).toBeUndefined();
    expect(steamIdOf(player({ platforms: 'nope' }))).toBeUndefined();
    expect(steamIdOf(null)).toBeUndefined();
  });
});

describe('parseRaceosPlayer', () => {
  it('reads ranks, badge and country', () => {
    expect(parseRaceosPlayer(player())).toEqual({
      driverRank: 'Gold',
      driverTier: 3,
      safetyRank: 'Silver',
      safetyTier: 1,
      badge: 'lemans-2024',
      countryCode: 'FR',
    });
  });

  it('gives Pro no tier', () => {
    const parsed = parseRaceosPlayer(
      player({ driverRank: { rank: 'Pro', tier: 5 } })
    );
    expect(parsed?.driverRank).toBe('Pro');
    expect(parsed?.driverTier).toBeUndefined();
  });

  it('drops a rank name it does not know', () => {
    // An unknown rank would reach the renderer and draw an unstyled chip.
    const parsed = parseRaceosPlayer(
      player({ driverRank: { rank: 'Diamond', tier: 1 } })
    );
    expect(parsed?.driverRank).toBeUndefined();
    expect(parsed?.driverTier).toBeUndefined();
  });

  it('drops a tier that arrives without a rank', () => {
    const parsed = parseRaceosPlayer(player({ driverRank: { tier: 4 } }));
    expect(parsed?.driverTier).toBeUndefined();
  });

  it('treats a record with nothing usable as a miss', () => {
    // Returning an empty rating would have the caller cache a hit that
    // renders as nothing, and never re-ask.
    expect(
      parseRaceosPlayer({ id: 'x', platforms: [], profile: {} })
    ).toBeUndefined();
  });

  it('never throws on a shape it does not recognise', () => {
    for (const value of [null, undefined, 42, 'text', [], {}]) {
      expect(() => parseRaceosPlayer(value)).not.toThrow();
    }
  });
});

describe('parseRaceosPlayers', () => {
  it('keys results by steam id', () => {
    const map = parseRaceosPlayers([player()]);
    expect(map.get('76561198000000001')?.driverRank).toBe('Gold');
  });

  it('accepts the wrapped forms as well as a bare array', () => {
    // The wrapper has been seen both ways; guessing wrong costs every badge.
    expect(parseRaceosPlayers({ players: [player()] }).size).toBe(1);
    expect(parseRaceosPlayers({ data: [player()] }).size).toBe(1);
    expect(parseRaceosPlayers([player()]).size).toBe(1);
  });

  it('skips records with no steam id', () => {
    expect(parseRaceosPlayers([player({ platforms: [] })]).size).toBe(0);
  });

  it('returns an empty map for anything unrecognised', () => {
    for (const value of [null, undefined, 42, 'text', {}]) {
      expect(parseRaceosPlayers(value).size).toBe(0);
    }
  });
});
