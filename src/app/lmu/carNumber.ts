/**
 * The car number LMU embeds in an entry's vehicle name.
 *
 * Shared memory has no car-number field, but it does not need one: LMU names
 * every entry `<Team> #<Number>:<Series>`, and that number is the real race
 * number. Observed on a recorded ELMS grid:
 *
 * ```
 * DKR Engineering #3:ELMS26        -> 3
 * Proton Competition #88:ELMS26    -> 88
 * Team WRT 2026 #32:WEC            -> 32
 * ```
 *
 * The alternative source is `/rest/watch/standings`, whose `carNumber` field is
 * what LMUTraceHUB reads. Parsing the name is preferred because it needs no
 * endpoint, works in single player and in a tape replay, and the number is
 * already in a field the session signature watches -- so a correction
 * republishes on its own. LMUTraceHUB keeps the same parse as its own fallback
 * (`parseCarNumber`, which splits on `#`).
 *
 * Returns undefined rather than guessing, so the caller can keep its own
 * fallback for a name in a shape this does not recognise.
 */

/**
 * Everything between the first `#` and the `:` that ends it.
 *
 * Bounded by `:` rather than by digits so a number carrying a letter -- some
 * series run a `1A` -- survives, while the series tag that follows never
 * becomes part of it.
 */
const EMBEDDED = /#([^:]*)/;

export const lmuCarNumber = (vehicleName?: string): string | undefined => {
  if (!vehicleName) return undefined;

  const found = EMBEDDED.exec(vehicleName);
  const raw = found?.[1]?.trim();
  // Must begin with a digit. A team name containing a `#` would otherwise
  // hand back a fragment of itself as the car number.
  if (!raw || !/^\d/.test(raw)) return undefined;

  // Any trailing words are not part of the number: a name without the series
  // suffix would otherwise take the rest of the string with it.
  const number = /^\d+[A-Za-z]?/.exec(raw)?.[0];
  return number;
};

/**
 * The same number as an integer, for sorting and for the iRacing-shaped
 * `CarNumberRaw`. Undefined when the number is not purely numeric.
 */
export const lmuCarNumberRaw = (vehicleName?: string): number | undefined => {
  const number = lmuCarNumber(vehicleName);
  if (!number || !/^\d+$/.test(number)) return undefined;
  const parsed = Number.parseInt(number, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};
