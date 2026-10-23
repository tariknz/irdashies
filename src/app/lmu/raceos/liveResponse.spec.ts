import { describe, expect, it } from 'vitest';
import { parseRaceosPlayers } from './parse';

/**
 * The parser against a response the live service actually sent.
 *
 * Every other spec here feeds the parser a shape written to match what the
 * parser expects, which cannot catch the parser expecting the wrong thing. The
 * payload below is a real `POST /api/v1/players` reply, trimmed only of
 * personal details that have no business in a fixture: the e-mail address, the
 * avatar URL, the Steam id and the subscription block.
 *
 * Kept because the two fields that decide whether a badge renders at all --
 * `driverRank.rank` and `safetyRank.rank` -- are free text from a third party.
 * A deployment that renamed a rank, or moved it one level in the object, would
 * leave `parseRaceosPlayers` returning entries with no ranks in them. The
 * client would log "Resolved 2/2 driver ratings" and the standings would show
 * nothing, which is a failure worth a test that cannot drift with the code.
 */
const LIVE_RESPONSE = [
  {
    id: '98fab0c2-36d3-4e24-9a83-55eee03809a9',
    platforms: [
      { id: '<redacted>', platform: 'steam' },
      { id: '98fab0c2-36d3-4e24-9a83-55eee03809a9', platform: 'nakama' },
    ],
    lastLogin: '0001-01-01T00:00:00Z',
    lastNameChange: '0001-01-01T00:00:00Z',
    requiresReview: false,
    name: 'Herve Attard',
    username: 'Herve Attard',
    driverRank: { elo: 0, rank: 'Bronze', tier: 3, progress: 70 },
    safetyRank: {
      rank: 'Silver',
      tier: 2,
      rating: 0,
      progress: 20,
      contactImpactsPerLapRatio: 0,
      contactImpactsPerLapRatios: null,
    },
    profile: {
      email: '',
      nationality: 'US',
      badge: 'sr-saint',
      badges: null,
      optins: null,
      verified: null,
    },
    jokers: { available: 0, progress: 15, eventsToEarnJoker: 20 },
    timezone: '',
    crossplay: true,
    enforcement: null,
  },
  {
    id: 'c80d0051-c7c2-46df-a55e-9eb921bd0456',
    platforms: [{ id: '<redacted>', platform: 'steam' }],
    requiresReview: false,
    name: 'Leonel Gomez',
    username: 'Leonel Gomez',
    driverRank: { elo: 0, rank: 'Silver', tier: 1, progress: 10 },
    safetyRank: { rank: 'Platinum', tier: 3, rating: 0, progress: 90 },
    profile: { nationality: 'AR', badge: 'sr-saint', badges: null },
    jokers: { available: 0, progress: 25, eventsToEarnJoker: 30 },
    timezone: '',
    crossplay: true,
    enforcement: null,
  },
];

describe('parseRaceosPlayers against a live response', () => {
  const parsed = () => parseRaceosPlayers(LIVE_RESPONSE);

  it('keys both drivers by the name the lookup asked for', () => {
    expect([...parsed().keys()].sort()).toEqual([
      'Herve Attard',
      'Leonel Gomez',
    ]);
  });

  it('reads the ranks the badge needs to render', () => {
    // LmuRatingBadge draws nothing without one of these two, so a rating that
    // parses without them is indistinguishable from no rating at all.
    const herve = parsed().get('Herve Attard');
    expect(herve?.driverRank).toBe('Bronze');
    expect(herve?.driverTier).toBe(3);
    expect(herve?.safetyRank).toBe('Silver');
    expect(herve?.safetyTier).toBe(2);

    const leonel = parsed().get('Leonel Gomez');
    expect(leonel?.driverRank).toBe('Silver');
    expect(leonel?.driverTier).toBe(1);
    expect(leonel?.safetyRank).toBe('Platinum');
    expect(leonel?.safetyTier).toBe(3);
  });

  it('reads the badge and the nationality', () => {
    const herve = parsed().get('Herve Attard');
    expect(herve?.badge).toBe('sr-saint');
    // The service answers alpha-2 here; the sim's own teams endpoint answers
    // alpha-3. Both have to end up as the alpha-2 the flag component wants.
    expect(herve?.countryCode).toBe('US');
    expect(parsed().get('Leonel Gomez')?.countryCode).toBe('AR');
  });

  it('ignores the fields it has no use for', () => {
    // elo, progress, jokers, enforcement and the rest are read past rather
    // than choked on, so the service can keep adding to the record.
    const herve = parsed().get('Herve Attard');
    expect(Object.keys(herve ?? {}).sort()).toEqual([
      'badge',
      'countryCode',
      'driverRank',
      'driverTier',
      'safetyRank',
      'safetyTier',
    ]);
  });
});
