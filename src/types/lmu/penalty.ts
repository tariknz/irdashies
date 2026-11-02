/**
 * Which penalty a driver is serving.
 *
 * Two sources, and they are not equal.
 *
 * The authoritative one is LMU's UI websocket. Subscribing to its
 * `LiveStandings` topic yields one entry per car whose `penalties` are broken
 * out by kind -- drive-throughs, stop-gos and time penalties counted
 * separately -- so the kind is stated for every car rather than inferred for
 * one. See app/lmu/liveStandings/.
 *
 * The fallback below is what this app had before that socket was found, and it
 * covers the player alone. Scoring carries `mNumPenalties`, a count, and
 * nothing about the kind; `/rest/strategy/pitstop-estimate` returns a
 * `penalties` figure in seconds for the player's own next stop. The two kinds
 * that are served differ in exactly that -- a drive-through costs no
 * stationary time, a stop-go mandates it -- so for the player the count and
 * the seconds together name the kind:
 *
 * | count | seconds | kind |
 * | --- | --- | --- |
 * | 0 | anything | none outstanding |
 * | >0 | 0 | drive-through |
 * | >0 | >0 | stop-go |
 *
 * Confirmed on a live session -- `penalties` 0.0 with a drive-through
 * outstanding, 10.0 with a stop-go. Its known hole is the third kind: a time
 * penalty also costs seconds at the stop, so this reads one as a stop-go.
 * That is why it is the fallback and not the source, and why it is only
 * reached for a car the socket has said nothing about.
 *
 * Lives in types rather than under app/lmu because both sides need it: the
 * frontend decides what to draw and the frontend may not import from app.
 * A pure function over two numbers, like lmuChipChrome next door.
 */

/**
 * What the badge shows.
 *
 * The sim's own shorthand for the two that are served on track, and the third
 * spelled out because it is not served at all -- a time penalty is added to
 * the car's race time at its next stop, so there is no manoeuvre to name.
 */
export type LmuPenaltyKind = 'DT' | 'SG' | 'TIME';

/**
 * The kinds as a number, for the per-car telemetry channel.
 *
 * A channel is an array of numbers, so the kind travels as a code. `none` is 0
 * so an untouched slot in a freshly allocated array already means what it
 * should, and the codes ascend in the order the kinds are served.
 */
export const LMU_PENALTY_CODE = {
  none: 0,
  driveThrough: 1,
  stopGo: 2,
  time: 3,
} as const;

const CODE_TO_KIND: Record<number, LmuPenaltyKind> = {
  [LMU_PENALTY_CODE.driveThrough]: 'DT',
  [LMU_PENALTY_CODE.stopGo]: 'SG',
  [LMU_PENALTY_CODE.time]: 'TIME',
};

const KIND_TO_CODE: Record<LmuPenaltyKind, number> = {
  DT: LMU_PENALTY_CODE.driveThrough,
  SG: LMU_PENALTY_CODE.stopGo,
  TIME: LMU_PENALTY_CODE.time,
};

/** The code for a kind, or `none` for a clean car. */
export const lmuPenaltyCode = (kind: LmuPenaltyKind | undefined): number =>
  kind ? KIND_TO_CODE[kind] : LMU_PENALTY_CODE.none;

/**
 * The kind a code names, or undefined for a clean car or an unknown code.
 *
 * Undefined for a code this build does not know, rather than a default: a
 * future kind arriving as a 4 is better drawn as nothing than as a stop-go.
 */
export const lmuPenaltyKindFromCode = (
  code: number | undefined
): LmuPenaltyKind | undefined =>
  typeof code === 'number' ? CODE_TO_KIND[code] : undefined;

/**
 * The player's kind from their count and their stop estimate, the fallback.
 *
 * Undefined when there is nothing outstanding or no way to tell -- rather than
 * a default, unlike LMUTraceHUB, which falls back to "DT" when its derivation
 * comes back empty. That reads a missing penalty time as a drive-through, and
 * the two are not the same thing: with no estimate polled yet, nothing is
 * known.
 *
 * Never returns 'TIME', which it has no way to recognise. See the note above.
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

/**
 * The badge for one car: the sim's answer where there is one, the fallback
 * where there is not.
 *
 * One place states the precedence, because three row builders need it and a
 * rule spread across three expressions is a rule that drifts. The websocket's
 * code wins outright -- it is the sim naming the kind -- and the estimate is
 * consulted only for the player, only when the socket said nothing about
 * them, and knowing it will call a time penalty a stop-go.
 */
export const lmuPenaltyBadge = (
  penaltyCode: number | undefined,
  isPlayer: boolean,
  penalties: number | undefined,
  penaltySeconds: number | undefined
): LmuPenaltyKind | undefined =>
  lmuPenaltyKindFromCode(penaltyCode) ??
  (isPlayer ? lmuPenaltyKind(penalties, penaltySeconds) : undefined);

/**
 * What the badge actually reads.
 *
 * The two that are served on track are named, because naming them says what
 * the driver has to do. A time penalty is not served at all -- it is added to
 * the car's race time -- so what matters about it is how much, and it reads as
 * its magnitude: `+10`. doX's row formatter draws the same distinction, two
 * letters for the served kinds and a signed number for the added one.
 *
 * Falls back to `TIME` when the magnitude is unknown, rather than to a bare
 * `+0`: a time penalty whose seconds have not arrived is still a time penalty,
 * and `+0` would read as costing nothing.
 */
export const lmuPenaltyBadgeText = (
  kind: LmuPenaltyKind | undefined,
  penaltySeconds?: number
): string | undefined => {
  if (!kind) return undefined;
  if (kind !== 'TIME') return kind;
  const seconds =
    typeof penaltySeconds === 'number' && Number.isFinite(penaltySeconds)
      ? Math.round(penaltySeconds)
      : 0;
  return seconds > 0 ? `+${seconds}` : 'TIME';
};
