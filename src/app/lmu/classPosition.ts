/**
 * Position within class, which LMU does not publish.
 *
 * Its scoring block carries `mPlace` -- overall position -- but nothing per
 * class, and the standings widget reads class position. Left empty, the widget
 * fell back to the qualifying grid, which in a practice session is LMU's
 * `mQualification`: entry order, fixed for the whole session. That is why the
 * column tracked car number and never moved.
 *
 * The ranking follows the convention iRacing sets, so either sim produces the
 * same meaning:
 *
 * - A race ranks on the sim's own overall position, which already accounts for
 *   laps completed and sector order.
 * - Practice and qualifying rank on best lap time, because position in those
 *   sessions is a timesheet, not a running order. A car with no time yet sorts
 *   last rather than first, which a plain ascending sort on 0 or -1 would get
 *   backwards.
 *
 * Output is 1-based, matching the `CarIdxClassPosition` telemetry channel it
 * fills. Note that is the opposite of `ClassPosition` in session results,
 * which iRacing publishes 0-based -- the two are different contracts and
 * conflating them is what made every class start at 2.
 */

/**
 * How far down the order a car sits, lower being ahead.
 *
 * A race is already ordered by the sim, so its own place stands. Anything else
 * is a timesheet, where best lap decides it and a car yet to set a time
 * belongs at the bottom rather than the top -- which a plain ascending sort on
 * 0 or -1 gets backwards.
 *
 * Exported because two places need this same answer: the per-car telemetry
 * channels here, and the session results the standings widget orders on. Two
 * orderings drifting apart would have the two widgets disagreeing about who is
 * ahead.
 */
export const lmuOrderingKey = (
  isRace: boolean,
  place: number | undefined,
  bestLapTime: number | undefined
): number => {
  const value = isRace ? (place ?? 0) : (bestLapTime ?? 0);
  return value > 0 ? value : Number.POSITIVE_INFINITY;
};

/**
 * Compares two ordering keys, falling back to a stable tiebreak.
 *
 * Compared rather than subtracted: a car with no time carries an infinite key,
 * and `Infinity - 95` is itself infinite rather than a usable delta. Ties --
 * notably every car yet to set a time -- settle on the tiebreak so the order
 * does not reshuffle between frames.
 */
export const compareLmuOrder = (
  keyA: number,
  keyB: number,
  tiebreakA: number,
  tiebreakB: number
): number => {
  if (keyA !== keyB) return keyA < keyB ? -1 : 1;
  return tiebreakA - tiebreakB;
};

export interface LmuClassPositionState {
  /** In-class positions by car slot, 0 where unknown. Reused across frames. */
  positions: number[];
  /**
   * Outright positions by car slot, from the same ordering.
   *
   * The standings sort their rows on this, not on the in-class position, so a
   * correct class column rendered in mPlace order still reads as wrong. Free
   * to produce -- it is the index within the pass that already happened.
   */
  overall: number[];
  /** Fingerprint of the inputs that produced `positions`. */
  fingerprint: number;
  /** Scratch list of contending slots, reused so a frame allocates nothing. */
  order: number[];
}

export const createLmuClassPositionState = (): LmuClassPositionState => ({
  positions: [],
  overall: [],
  fingerprint: 0,
  order: [],
});

export const resetLmuClassPositionState = (
  state: LmuClassPositionState
): void => {
  state.positions.length = 0;
  state.overall.length = 0;
  state.order.length = 0;
  state.fingerprint = 0;
};

export interface LmuClassPositionFrame {
  /** Class id per car. */
  classes: ArrayLike<number> | undefined;
  /** Overall position per car, used for a race. */
  places: ArrayLike<number> | undefined;
  /** Best lap time per car in seconds, used otherwise. Non-positive is none. */
  bestLapTimes: ArrayLike<number> | undefined;
  /**
   * Lap fraction per car. Negative marks an empty slot -- the addon
   * sentinel-fills with -1 -- which is the same discriminator the rest of the
   * LMU mapping uses. Tested for non-negative rather than truthiness, because
   * 0 is a car sitting exactly on the start line.
   */
  lapDistPcts: ArrayLike<number> | undefined;
  isRace: boolean;
}

/** Lap times to whole milliseconds, so float noise cannot look like a change. */
const MS = 1000;

/**
 * The ordering inputs, mixed into one integer.
 *
 * Positions only move when a car completes a lap or changes place -- a handful
 * of times a minute, against a poll rate of 64 a second. Sorting every frame
 * regardless would be the overwhelming cost here, so a frame instead pays one
 * cheap pass to decide whether anything it depends on actually moved.
 */
const fingerprintOf = (frame: LmuClassPositionFrame, count: number): number => {
  const { classes, places, bestLapTimes, lapDistPcts, isRace } = frame;
  let hash = (isRace ? 0x9e37 : 0x85eb) ^ count;
  for (let carIdx = 0; carIdx < count; carIdx += 1) {
    if ((lapDistPcts?.[carIdx] ?? -1) < 0) continue;
    const key = isRace
      ? (places?.[carIdx] ?? 0)
      : Math.round((bestLapTimes?.[carIdx] ?? 0) * MS);
    hash = (Math.imul(hash, 31) + key) | 0;
    hash = (Math.imul(hash, 31) + (classes?.[carIdx] ?? 0)) | 0;
  }
  return hash;
};

/**
 * Positions by car slot, recomputed only when the ordering actually changed.
 *
 * The returned array is the state's own, reused between frames; a caller that
 * hands it onward should copy it.
 */
export function updateLmuClassPositions(
  state: LmuClassPositionState,
  frame: LmuClassPositionFrame
): number[] {
  const { classes, places, bestLapTimes, lapDistPcts, isRace } = frame;
  const count = classes?.length ?? 0;
  if (count === 0 || !classes) {
    state.positions.length = 0;
    state.overall.length = 0;
    state.fingerprint = 0;
    return state.positions;
  }

  const fingerprint = fingerprintOf(frame, count);
  if (fingerprint === state.fingerprint && state.positions.length === count) {
    return state.positions;
  }
  state.fingerprint = fingerprint;

  const { positions, overall, order } = state;
  positions.length = count;
  positions.fill(0);
  overall.length = count;
  overall.fill(0);

  order.length = 0;
  for (let carIdx = 0; carIdx < count; carIdx += 1) {
    if ((lapDistPcts?.[carIdx] ?? -1) < 0) continue;
    order.push(carIdx);
  }

  const keyOf = (carIdx: number): number =>
    lmuOrderingKey(isRace, places?.[carIdx], bestLapTimes?.[carIdx]);

  // Slot order is the tiebreak here, so the column does not reshuffle between
  // frames while nobody has set a time.
  order.sort((a, b) => compareLmuOrder(keyOf(a), keyOf(b), a, b));

  const rankByClass = new Map<number, number>();
  order.forEach((carIdx, index) => {
    const classId = classes[carIdx] ?? 0;
    const rank = (rankByClass.get(classId) ?? 0) + 1;
    rankByClass.set(classId, rank);
    positions[carIdx] = rank;
    overall[carIdx] = index + 1;
  });

  return positions;
}
