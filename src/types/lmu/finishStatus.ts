/**
 * Where a car stands at the end of its session, from scoring's
 * `mFinishStatus`.
 *
 * The sim states it per car, so nothing is inferred from laps or the session
 * phase -- the same field TinyPedal reads for its finish marker. The codes are
 * the sim's: 0 none, 1 finished, 2 did not finish, 3 disqualified.
 *
 * Lives in types rather than under app/lmu because the frontend decides what
 * to draw, and the frontend may not import from app. See penalty.ts next door,
 * whose badge this one takes the place of.
 */

/**
 * What the badge shows: a checkered flag for a car that has taken it, and the
 * usual shorthand for the two ways of not doing so.
 */
export type LmuFinishState = 'FINISHED' | 'DNF' | 'DQ';

/** The sim's codes, as `mFinishStatus` carries them. */
export const LMU_FINISH_STATUS = {
  none: 0,
  finished: 1,
  dnf: 2,
  dq: 3,
} as const;

const CODE_TO_STATE: Record<number, LmuFinishState> = {
  [LMU_FINISH_STATUS.finished]: 'FINISHED',
  [LMU_FINISH_STATUS.dnf]: 'DNF',
  [LMU_FINISH_STATUS.dq]: 'DQ',
};

/**
 * The state a code names, or undefined for a car still running or a code this
 * build does not know -- a future status drawn as nothing beats one drawn as
 * the wrong thing.
 */
export const lmuFinishStateFromCode = (
  code: number | undefined
): LmuFinishState | undefined =>
  typeof code === 'number' ? CODE_TO_STATE[code] : undefined;
