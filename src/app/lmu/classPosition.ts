/**
 * Position within class, which LMU does not publish.
 *
 * Its scoring block carries `mPlace` -- overall position -- but nothing per
 * class, and the standings widget reads class position. Left empty, the widget
 * fell back to the qualifying grid, which in a practice session is LMU's
 * `mQualification`: entry order, fixed for the whole session. That is why the
 * column tracked car number and never moved.
 *
 * Every session ranks on the sim's own overall position, so the relative and
 * the standings show what LMU's own screens show. In a race that accounts for
 * laps completed and sector order. In practice and qualifying LMU puts cars
 * with a valid best lap first, by that time, and every car without one after
 * them, by laps completed and then by how far round the lap it is.
 *
 * Output is 1-based, matching the `CarIdxClassPosition` telemetry channel it
 * fills. Note that is the opposite of `ClassPosition` in session results,
 * which iRacing publishes 0-based -- the two are different contracts and
 * conflating them is what made every class start at 2.
 */

/**
 * How far down the order a car sits, lower being ahead: LMU's own place, with
 * a car the sim has not placed at the bottom.
 *
 * Exported because two places need this same answer: the per-car telemetry
 * channels here, and the session results the standings widget orders on. Two
 * orderings drifting apart would have the two widgets disagreeing about who is
 * ahead.
 */
export const lmuOrderingKey = (place: number | undefined): number =>
  (place ?? 0) > 0 ? (place as number) : Number.POSITIVE_INFINITY;

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
  /** LMU's overall position per car. Non-positive is unplaced. */
  places: ArrayLike<number> | undefined;
  /**
   * Lap fraction per car. Negative marks an empty slot -- the addon
   * sentinel-fills with -1 -- which is the same discriminator the rest of the
   * LMU mapping uses. Tested for non-negative rather than truthiness, because
   * 0 is a car sitting exactly on the start line.
   */
  lapDistPcts: ArrayLike<number> | undefined;
}

/**
 * The ordering inputs, mixed into one integer.
 *
 * Positions only move when a car completes a lap or changes place -- a handful
 * of times a minute, against a poll rate of 64 a second. Sorting every frame
 * regardless would be the overwhelming cost here, so a frame instead pays one
 * cheap pass to decide whether anything it depends on actually moved.
 */
const fingerprintOf = (frame: LmuClassPositionFrame, count: number): number => {
  const { classes, places, lapDistPcts } = frame;
  let hash = 0x9e37 ^ count;
  for (let carIdx = 0; carIdx < count; carIdx += 1) {
    if ((lapDistPcts?.[carIdx] ?? -1) < 0) continue;
    const key = places?.[carIdx] ?? 0;
    // The slot, not just its contents. Skipping empty slots without hashing
    // the index made two frames identical whenever occupancy moved but the
    // sequence of (key, class) pairs did not -- a car with no time leaving
    // slot 1 as another of the same class joins slot 2. The early return below
    // then kept the previous answer, so the new slot read 0 and the vacated
    // one held its rank until some other ordering input changed.
    hash = (Math.imul(hash, 31) + carIdx) | 0;
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
  const { classes, places, lapDistPcts } = frame;
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

  const keyOf = (carIdx: number): number => lmuOrderingKey(places?.[carIdx]);

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
