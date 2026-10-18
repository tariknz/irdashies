import { describe, expect, it } from 'vitest';
import {
  parseRaceosPlayer,
  parseRaceosPlayers,
  raceosUsername,
  usernameOf,
} from './parse';

const player = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Jean Dupont',
  username: 'Jean Dupont',
  driverRank: { rank: 'Gold', tier: 3, progress: 0.42 },
  safetyRank: { rank: 'Silver', tier: 1, progress: 0.1 },
  platforms: [{ id: '76561198000000001', platform: 'steam' }],
  profile: { nationality: 'FRA', badge: 'lemans-2024' },
  ...over,
});

describe('raceosUsername', () => {
  it('keeps the name as the standings spell it', () => {
    // Sent verbatim: same capitalisation, UTF-8 intact. The service matched
    // "Herve Attard" exactly, so nothing here may lowercase or transliterate.
    expect(raceosUsername('Herve Attard')).toBe('Herve Attard');
    expect(raceosUsername('S\u00e9bastien Rival')).toBe('S\u00e9bastien Rival');
  });

  it('drops anything from a hash onward', () => {
    expect(raceosUsername('Herve Attard#1234')).toBe('Herve Attard');
    expect(raceosUsername('Name#a#b')).toBe('Name');
  });

  it('trims surrounding whitespace', () => {
    expect(raceosUsername('  Herve Attard  ')).toBe('Herve Attard');
    // Trimmed after the hash is cut, so padding before it goes too.
    expect(raceosUsername(' Herve Attard #9')).toBe('Herve Attard');
  });

  it('returns empty for a name that is only a suffix', () => {
    expect(raceosUsername('#1234')).toBe('');
    expect(raceosUsername('   ')).toBe('');
  });
});

describe('usernameOf', () => {
  it('reads the username a record belongs to', () => {
    expect(usernameOf(player())).toBe('Jean Dupont');
  });

  it('canonicalises what the service sent back', () => {
    // Both sides of the join go through the same function, so a name echoed
    // back with padding still matches the driver it belongs to.
    expect(usernameOf(player({ username: '  Jean Dupont  ' }))).toBe(
      'Jean Dupont'
    );
  });

  it('falls back to name when username is absent', () => {
    expect(usernameOf(player({ username: undefined }))).toBe('Jean Dupont');
  });

  it('returns undefined when neither is usable', () => {
    expect(usernameOf(player({ username: '', name: '' }))).toBeUndefined();
    expect(usernameOf(player({ username: 123, name: null }))).toBeUndefined();
    expect(usernameOf(null)).toBeUndefined();
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
  it('keys results by username', () => {
    const map = parseRaceosPlayers([player()]);
    expect(map.get('Jean Dupont')?.driverRank).toBe('Gold');
  });

  it('accepts the wrapped forms as well as a bare array', () => {
    // A live response is a bare array; the wrappers are kept as cheap
    // tolerance because guessing wrong costs every badge at once.
    expect(parseRaceosPlayers({ players: [player()] }).size).toBe(1);
    expect(parseRaceosPlayers({ data: [player()] }).size).toBe(1);
    expect(parseRaceosPlayers([player()]).size).toBe(1);
  });

  it('skips records with no usable name', () => {
    // Nothing to key the answer by, so it cannot be matched to a driver.
    expect(parseRaceosPlayers([player({ username: '', name: '' })]).size).toBe(
      0
    );
  });

  it('returns an empty map for anything unrecognised', () => {
    for (const value of [null, undefined, 42, 'text', {}]) {
      expect(parseRaceosPlayers(value).size).toBe(0);
    }
  });
});
