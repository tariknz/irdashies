/**
 * Where the player is, as LMU's own `/rest/sessions/GetGameState` says.
 *
 * This is the sim answering the question directly, and it replaces two
 * inferences from shared memory that were standing in for it: whether the
 * session is live (the block still being written, see dataFreeze.ts) and
 * whether the player is in the car (`mInRealtime` or the ignition). Both were
 * guesses. A paused session stops the writes without ending anything, and a
 * snapshot left behind by a session that has ended still says realtime.
 *
 * What the endpoint answers:
 *
 * - `{"MultiStintState":"DRIVING", ...}` -- in the car.
 * - `{"MultiStintState":"END_OF_RACE_GRACE", ...}` -- still in the car after
 *   the checkered flag (`gamePhase` GPHASE_CHECKERED), read as driving.
 * - `{"MultiStintState":"PAUSED", ...}` -- in the car with a menu open.
 * - `{"MultiStintState":"MONITOR_MENU", ...}` -- in the session, at the
 *   monitor rather than in the car.
 * - `{"status":"unavailable","reason":"Game is not in an active session",...}`
 *   -- running, but not in a session.
 * - HTTP 404 -- not in a game at all.
 *
 * Pure and dependency-free, like the other parsers: it never throws. An
 * answer it does not recognise is no state at all, so the bridge reads shared
 * memory as it does when nothing answers, rather than holding the last state
 * or guessing a new one.
 */

export type LmuGameState =
  /** In the car. */
  | 'driving'
  /** In the car with a menu open. */
  | 'paused'
  /** In the session, but at the monitor rather than in the car. */
  | 'monitor'
  /** The sim is running and in no session. */
  | 'notInSession'
  /** The sim is running and in no game at all. */
  | 'notInGame';

export interface ParsedLmuGameState {
  /** Undefined for an answer this does not recognise. */
  state: LmuGameState | undefined;
  /** What arrived, when it was not recognised, so the log can say. */
  unrecognised?: string;
}

const MULTI_STINT_STATES: Record<string, LmuGameState> = {
  DRIVING: 'driving',
  // The grace after the checkered flag: the player is still driving to the
  // line or the pits, and the widgets stay as they were.
  END_OF_RACE_GRACE: 'driving',
  PAUSED: 'paused',
  MONITOR_MENU: 'monitor',
};

/** Whether a body is the `{"status":"unavailable"}` answer. */
const isUnavailable = (payload: Record<string, unknown>): boolean =>
  typeof payload.status === 'string' &&
  payload.status.toLowerCase() === 'unavailable';

/** A short account of an answer that is neither shape, for the log. */
const describeAnswer = (payload: unknown): string => {
  if (payload === undefined) return 'answer that is not JSON';
  if (payload === null || typeof payload !== 'object') {
    return `answer ${JSON.stringify(payload).slice(0, 40)}`;
  }
  if (Array.isArray(payload)) return 'answer that is an array';
  const keys = Object.keys(payload);
  return keys.length
    ? `answer with ${keys.slice(0, 6).join(', ')}`
    : 'empty answer';
};

/**
 * Reads a GetGameState body, or `undefined` for one that is not JSON.
 *
 * Always returns a value, so the poller writes it: an unrecognised answer
 * has to replace the state before it, not leave it standing.
 */
export function parseLmuGameState(payload: unknown): ParsedLmuGameState {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { state: undefined, unrecognised: describeAnswer(payload) };
  }
  const record = payload as Record<string, unknown>;
  const multiStint = record.MultiStintState;
  if (typeof multiStint === 'string') {
    const state = MULTI_STINT_STATES[multiStint];
    return state
      ? { state }
      : {
          state: undefined,
          unrecognised: `MultiStintState ${JSON.stringify(multiStint)}`,
        };
  }
  if (isUnavailable(record)) return { state: 'notInSession' };
  return { state: undefined, unrecognised: describeAnswer(record) };
}

/**
 * Reads a GetGameState request that did not succeed, for the two failures
 * that are answers: a 404 is the sim outside any game, and an `unavailable`
 * body is the sim outside any session whatever status it came with. Anything
 * else -- a timeout, a refused connection, a 500 -- says nothing about the
 * player and yields undefined.
 */
export function readLmuGameStateFailure(failure: {
  readonly status?: number;
  readonly body?: string;
}): ParsedLmuGameState | undefined {
  if (failure.status === 404) return { state: 'notInGame' };
  if (!failure.body) return undefined;
  let payload: unknown;
  try {
    payload = JSON.parse(failure.body);
  } catch {
    return undefined;
  }
  return parseLmuGameState(payload).state === 'notInSession'
    ? { state: 'notInSession' }
    : undefined;
}

/** In a session, whether in the car or at the monitor. */
export const lmuInSession = (state: LmuGameState): boolean =>
  state === 'driving' || state === 'paused' || state === 'monitor';

/** In the car, paused or not. */
export const lmuInCar = (state: LmuGameState): boolean =>
  state === 'driving' || state === 'paused';

const DESCRIPTIONS: Record<LmuGameState, string> = {
  driving: 'in the car',
  paused: 'in the car, paused',
  monitor: 'in the session, at the monitor',
  notInSession: 'not in a session',
  notInGame: 'not in a game',
};

/** A state for the log, or what happens while there is none. */
export const describeLmuGameState = (
  state: LmuGameState | undefined
): string =>
  state
    ? DESCRIPTIONS[state]
    : 'unknown; reading in-car and in-session from shared memory';
