import type { LmuDriverRating, LmuRank } from '@irdashies/types';
import { isLmuTieredRank } from '@irdashies/types';
import { normaliseNationality } from '../nationality';

/**
 * Reads the rating service's player records.
 *
 * Same hard rule as `lmu/rest/tasks.ts`: **a parser never throws.** It returns
 * undefined for anything it does not recognise and the caller keeps whatever
 * it had. A third-party service is free to change its payload between
 * deployments, and a surprise there must cost one missing badge, not a dead
 * lookup loop.
 *
 * The record shape, from a live response:
 *
 * ```json
 * { "id": "98fab0c2-...", "name": "Herve Attard", "username": "Herve Attard",
 *   "driverRank": { "elo": 0, "rank": "Bronze", "tier": 3, "progress": 70 },
 *   "safetyRank": { "rank": "Silver", "tier": 2, "progress": 20 },
 *   "platforms": [ { "id": "7656119...", "platform": "steam" },
 *                  { "id": "98fab0c2-...", "platform": "nakama" } ],
 *   "profile":   { "nationality": "US", "badge": "sr-saint" } }
 * ```
 *
 * Records are keyed by `username`, because that is what the lookup asks by --
 * the service takes a list of names, not ids. `platforms` does carry a Steam
 * id, but it is of no use here: the sim reports 0 for every driver, which is
 * what ruled out an id-keyed lookup in the first place.
 */

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * A rank name, or undefined.
 *
 * 'Pro' is accepted alongside the tiered ranks but carries no tier -- see
 * LmuDriverRating. Anything else is dropped rather than passed through: an
 * unknown rank would reach the renderer and be drawn as an unstyled chip.
 */
const asRank = (value: unknown): LmuRank | undefined => {
  const name = asString(value);
  if (!name) return undefined;
  if (name === 'Pro') return 'Pro';
  return isLmuTieredRank(name) ? name : undefined;
};

const asTier = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;

/** Pulls `{ rank, tier }` out of a driverRank/safetyRank block. */
const readRank = (value: unknown): { rank?: LmuRank; tier?: number } => {
  const block = asRecord(value);
  if (!block) return {};
  const rank = asRank(block.rank);
  // A tier without a rank is meaningless, so it is dropped with the rank.
  if (!rank) return {};
  return { rank, tier: rank === 'Pro' ? undefined : asTier(block.tier) };
};

/**
 * The name to ask the rating service about, from the name the sim reports.
 *
 * Sent as the standings spell it: same capitalisation, UTF-8 intact, and the
 * `#1234` discriminator kept. That suffix is part of the username, not noise
 * -- for `Sherry Dalton#6487` the service answers
 * `{"username":"Sherry Dalton#6487","name":"Sherry Dalton"}`, so the full
 * string is what identifies the player and the bare name is a display label
 * that several players can share.
 *
 * Only surrounding whitespace is removed. Applied to both sides of the join:
 * the request is built from it and the response's own `username` goes through
 * it again before matching, so padding on either side cannot break the join.
 */
export const raceosUsername = (name: string): string => name.trim();

/**
 * The username a record belongs to, canonicalised for matching.
 *
 * Returned so the caller can key the result: the service does not guarantee
 * the response order matches the request, and it answers only for the names
 * it knows, so the two lists are not even the same length.
 */
export const usernameOf = (record: unknown): string | undefined => {
  const player = asRecord(record);
  if (!player) return undefined;
  // `username` and not `name`: where they differ, `username` carries the
  // `#1234` discriminator and `name` is the bare label. The request asked by
  // username, so keying by anything else files the answer under something no
  // driver presents. `name` is a fallback only for a record without one.
  const raw = asString(player.username) ?? asString(player.name);
  if (!raw) return undefined;
  const cleaned = raceosUsername(raw);
  return cleaned.length > 0 ? cleaned : undefined;
};

/** One player record to the shape the renderer consumes, or undefined. */
export function parseRaceosPlayer(
  record: unknown
): LmuDriverRating | undefined {
  const player = asRecord(record);
  if (!player) return undefined;

  const driver = readRank(player.driverRank);
  const safety = readRank(player.safetyRank);
  const profile = asRecord(player.profile);

  const rating: LmuDriverRating = {
    driverRank: driver.rank,
    driverTier: driver.tier,
    safetyRank: safety.rank,
    safetyTier: safety.tier,
    badge: asString(profile?.badge),
    countryCode: normaliseNationality(profile?.nationality),
  };

  // An entirely empty record is a miss, not a rating. Returning it would have
  // the caller cache a hit that renders as nothing.
  const populated = Object.values(rating).some((v) => v !== undefined);
  return populated ? rating : undefined;
}

/**
 * A rating already in the renderer's shape, read back from storage that
 * someone else wrote -- a tape's baked ratings -- or undefined.
 *
 * Held to the same rules as a fresh record: an unknown rank is dropped rather
 * than drawn as an unstyled chip, a tier only counts with its rank, and an
 * entry left with nothing usable is a miss.
 */
export function parseStoredRating(value: unknown): LmuDriverRating | undefined {
  const stored = asRecord(value);
  if (!stored) return undefined;

  const driverRank = asRank(stored.driverRank);
  const safetyRank = asRank(stored.safetyRank);
  const rating: LmuDriverRating = {
    driverRank,
    driverTier:
      driverRank && driverRank !== 'Pro'
        ? asTier(stored.driverTier)
        : undefined,
    safetyRank,
    safetyTier:
      safetyRank && safetyRank !== 'Pro'
        ? asTier(stored.safetyTier)
        : undefined,
    badge: asString(stored.badge),
    countryCode: normaliseNationality(stored.countryCode),
  };

  const populated = Object.values(rating).some((v) => v !== undefined);
  return populated ? rating : undefined;
}

/**
 * A players response to ratings keyed by Steam ID.
 *
 * A live response is a bare array. `{ players: [...] }` and `{ data: [...] }`
 * are still accepted because guessing wrong costs every badge at once, and the
 * tolerance is three lines.
 */
export function parseRaceosPlayers(
  payload: unknown
): Map<string, LmuDriverRating> {
  const out = new Map<string, LmuDriverRating>();
  const wrapper = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(wrapper?.players)
      ? wrapper.players
      : Array.isArray(wrapper?.data)
        ? wrapper.data
        : undefined;
  if (!list) return out;

  for (const record of list) {
    const username = usernameOf(record);
    if (!username) continue;
    const rating = parseRaceosPlayer(record);
    if (rating) out.set(username, rating);
  }
  return out;
}
