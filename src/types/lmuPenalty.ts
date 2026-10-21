/**
 * Which penalty a driver is serving, from the only two facts LMU gives.
 *
 * Scoring carries `mNumPenalties`, a count, and nothing about the kind. Three
 * reference implementations agree on that: TinyPedal's abstract reader
 * declares only `number_penalties`, Racelab's string tables hold no rF2 or LMU
 * penalty field beyond the count, and LMUTraceHUB reads the count from scoring
 * and the kind from somewhere else.
 *
 * That somewhere else is the pit-stop estimate. `/rest/strategy/pitstop-estimate`
 * returns a `penalties` figure in seconds, and the two kinds differ in exactly
 * that: a drive-through costs no stationary time, a stop-go mandates it.
 * Confirmed on a live session -- `penalties` 0.0 with a drive-through
 * outstanding, 10.0 with a stop-go.
 *
 * So the kind is a function of the count and the time, and nothing else:
 *
 * | count | seconds | kind |
 * | --- | --- | --- |
 * | 0 | anything | none outstanding |
 * | >0 | 0 | drive-through |
 * | >0 | >0 | stop-go |
 *
 * Lives in types rather than under app/lmu because both sides need it: the
 * frontend decides what to draw and the frontend may not import from app.
 * A pure function over two numbers, like lmuChipChrome next door.
 *
 * The estimate is the player's own pit stop, so the time -- and therefore the
 * kind -- is only knowable for the player. Every other car has its count and
 * no more, which is why this takes them separately rather than pretending to
 * a per-car answer.
 */

/** What the badge shows. Deliberately the sim's own two-letter shorthand. */
export type LmuPenaltyKind = 'DT' | 'SG';

/**
 * The kind, or undefined when there is nothing outstanding or no way to tell.
 *
 * Undefined rather than a default, unlike LMUTraceHUB, which falls back to
 * "DT" when its derivation comes back empty. That reads a missing penalty time
 * as a drive-through, and the two are not the same thing: with no estimate
 * polled yet, nothing is known.
 */
export const lmuPenaltyKind = (
  penalties: number | undefined,
  penaltySeconds: number | undefined
): LmuPenaltyKind | undefined => {
  if (typeof penalties !== 'number' || !(penalties > 0)) return undefined;
  if (typeof penaltySeconds !== 'number' || !Number.isFinite(penaltySeconds)) {
    return undefined;
  }
  return penaltySeconds > 0 ? 'SG' : 'DT';
};
