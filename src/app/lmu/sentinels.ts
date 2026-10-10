/**
 * The "no value" convention the rest of the app reads, applied at the LMU
 * boundary.
 *
 * `formatTime` returns '' for a negative and renders 0 as "0:00.000", and the
 * standings cells hand it their value unguarded, so -1 is what a missing lap
 * time has to be. iRacing already satisfies this: a captured frame carries
 * CarIdxBestLapTime [-1, -1, 113.37, ...] and its session results use
 * FastestTime: -1.
 *
 * LMU reaches the app by two independent routes -- the telemetry frame and
 * the session snapshot -- built by different native functions from the same
 * scoring block. Both have to agree, because createStandings falls back from
 * one to the other: a lap time absent from telemetry is taken from the
 * session results instead, so normalising only the frame leaves the zero
 * showing.
 */

/** What every consumer reads as "there is no time here". */
export const ABSENT_LAP_TIME = -1;

/**
 * A lap time, or the absent sentinel.
 *
 * Keyed on the value rather than on whether the slot holds a car, because 0
 * is never a legitimate lap time whoever wrote it -- LMU itself for a car
 * that has not set one, or the addon's zero-filled array holes.
 */
export const lapTimeOrAbsent = (time: number | undefined): number =>
  typeof time === 'number' && time > 0 ? time : ABSENT_LAP_TIME;
