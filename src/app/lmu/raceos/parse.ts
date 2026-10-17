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
 * The record shape, as observed:
 *
 * ```json
 * { "id": "...", "name": "...", "username": "...",
 *   "driverRank": { "rank": "Gold", "tier": 3, "progress": 0.42 },
 *   "safetyRank": { "rank": "Silver", "tier": 1, "progress": 0.1 },
 *   "platforms": [ { "id": "7656119...", "platform": "steam" } ],
 *   "profile":   { "nationality": "FRA", "badge": "lemans-2024" } }
 * ```
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
 * The Steam ID a record belongs to, from its platform list.
 *
 * A player can have several platforms; only the Steam one identifies them in
 * an LMU session. Returned so the caller can key the result, because the
 * service does not guarantee response order matches the request.
 */
export const steamIdOf = (record: unknown): string | undefined => {
  const platforms = asRecord(record)?.platforms;
  if (!Array.isArray(platforms)) return undefined;
  for (const entry of platforms) {
    const platform = asRecord(entry);
    if (asString(platform?.platform)?.toLowerCase() !== 'steam') continue;
    const id = asString(platform?.id);
    if (id) return id;
  }
  return undefined;
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
 * A players response to ratings keyed by Steam ID.
 *
 * Accepts either a bare array or `{ players: [...] }` / `{ data: [...] }`:
 * the wrapper has been seen both ways and guessing wrong costs every badge.
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
    const steamId = steamIdOf(record);
    if (!steamId) continue;
    const rating = parseRaceosPlayer(record);
    if (rating) out.set(steamId, rating);
  }
  return out;
}
