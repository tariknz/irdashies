import { fnv1a32 } from './hash';

/**
 * A session id LMU does not provide.
 *
 * `mScoringInfo.mSession` is the session *type* -- 1 for practice, and so on
 * -- not an identifier. The mappers published it as both `SubSessionID` and
 * `SessionUniqueID`, so every practice session LMU has ever run reported the
 * same id, and two different sessions were indistinguishable.
 *
 * That broke session-change detection outright. Everything that decides a
 * session has changed by comparing ids -- race control, lap history, the
 * reference lap, the replay context, the standings processor's results
 * snapshot -- compared 1 against 1 and kept its state. Changing track left the
 * standings showing the grid from the track before, because as far as those
 * consumers were concerned nothing had happened. The renderer's lap tracer was
 * the exception, and only because it keys on the track id instead.
 *
 * Derived from track, session type and server, which is as close to identity
 * as LMU exposes:
 *
 * - **track** so a track change is a new session, which is the case that
 *   showed the bug;
 * - **type** so practice, qualifying and the race are each their own;
 * - **server** so two servers running the same event do not share stored lap
 *   history.
 *
 * Deliberately stable rather than unique per join: reconnecting to the same
 * event is the same session, and should find its history where it left it.
 * That is also why the clock is not in it.
 *
 * Which leaves one case the stamp alone cannot see, and it is the common one
 * online: a server rolling its practice session. Nothing identifying moves --
 * same track, same type, same server, often the same length -- so the stamp is
 * unchanged and every consumer keeps its state. `createLmuSessionIdentity`
 * below closes that, the way TinyPedal's `is_same_session` does.
 */

/** Just enough of either raw shape; both come from the addon's `read`. */
interface LmuSessionIdentitySource {
  trackName?: string;
  session?: number;
  serverName?: string;
}

/** Separates the parts, so neighbouring values cannot run together. */
const SEP = '\u0001';

export const lmuSessionUniqueId = (raw: LmuSessionIdentitySource): number => {
  const id = fnv1a32(
    `${raw.trackName ?? ''}${SEP}${raw.session ?? -1}${SEP}${raw.serverName ?? ''}`
  );
  // 0 is reserved: ReplayContextProcessor reads it as "no session named", the
  // convention iRacing's offline sessions set. A hash landing there is
  // vanishingly unlikely and would be baffling, so it is spent here.
  return id === 0 ? 1 : id;
};

/**
 * Why the identity advanced, for the caller to log. Null when it did not.
 */
export type LmuSessionChange = 'stamp' | 'event' | 'clock' | 'laps';

export interface LmuSessionIdentitySample {
  trackName?: string;
  session?: number;
  serverName?: string;
  /** Session length in seconds; part of the stamp, as TinyPedal has it. */
  endET?: number;
  /** Seconds into the session. Must not go backwards within one session. */
  currentET?: number;
  /** The player's completed laps, or undefined when there is no player car. */
  playerLaps?: number;
  /**
   * The sim's own session callbacks, as monotonic counters.
   *
   * Checked before the heuristics below and preferred over them, because an
   * increment here is the sim stating that a session started or ended rather
   * than this inferring it. Ending an online practice bumps
   * `sessionEndEvents` and changes nothing else: the window stays open, the
   * clock stops rather than resets, and the grid empties one driver at a time
   * -- so nothing else would have noticed.
   */
  sessionStartEvents?: number;
  sessionEndEvents?: number;
}

export interface LmuSessionIdentity {
  /**
   * Takes a reading and returns the id, advancing it if this is a new session.
   *
   * Called once per loop iteration by the bridge, which then hands the id to
   * both mappers -- so the frame and the snapshot cannot disagree about which
   * session they describe.
   */
  observe(sample: LmuSessionIdentitySample): number;
  /** The id as of the last observation. */
  current(): number;
  /** What the last observation changed, or null. Valid until the next one. */
  lastChange(): LmuSessionChange | null;
  reset(): void;
}

/**
 * How far the session clock may appear to go backwards before it counts.
 *
 * Scoring publishes at 5 Hz and the loop reads it at 125, so a repeated or
 * slightly stale read is ordinary. TinyPedal truncates to whole seconds and
 * compares with `<=`, which tolerates under a second; this is the same idea
 * with the tolerance stated rather than implied by a cast.
 */
const CLOCK_TOLERANCE_SECONDS = 2;

export const createLmuSessionIdentity = (): LmuSessionIdentity => {
  let stamp: string | null = null;
  let elapsed = 0;
  let laps: number | undefined;
  let events: number | undefined;
  let epoch = 0;
  let id = 0;
  let change: LmuSessionChange | null = null;

  const recompute = () => {
    const next = fnv1a32(`${stamp}${SEP}${epoch}`);
    id = next === 0 ? 1 : next;
  };

  return {
    observe(sample) {
      const nextStamp =
        `${sample.trackName ?? ''}${SEP}${sample.session ?? -1}` +
        `${SEP}${sample.serverName ?? ''}${SEP}${Math.round(sample.endET ?? -1)}`;
      const nextElapsed =
        typeof sample.currentET === 'number' &&
        Number.isFinite(sample.currentET)
          ? sample.currentET
          : elapsed;
      const nextLaps =
        typeof sample.playerLaps === 'number' && sample.playerLaps >= 0
          ? sample.playerLaps
          : undefined;

      // One number, because either callback firing is a boundary and both
      // only ever go up; which of the two it was does not change the answer.
      const nextEvents =
        typeof sample.sessionStartEvents === 'number' ||
        typeof sample.sessionEndEvents === 'number'
          ? (sample.sessionStartEvents ?? 0) + (sample.sessionEndEvents ?? 0)
          : undefined;

      change = null;
      if (nextStamp !== stamp) {
        // A different event, or the same one at a different length. The epoch
        // starts over so returning to a session already seen reuses its id,
        // and with it whatever was stored under it.
        stamp = nextStamp;
        epoch = 0;
        change = 'stamp';
      } else if (
        nextEvents !== undefined &&
        events !== undefined &&
        nextEvents !== events
      ) {
        // The sim said so. Preferred over the two heuristics below, and the
        // only thing that catches a session ending without being replaced --
        // where the clock stops rather than going backwards.
        epoch += 1;
        change = 'event';
      } else if (nextElapsed < elapsed - CLOCK_TOLERANCE_SECONDS) {
        // The clock cannot run backwards inside a session, so this is a new
        // one wearing the old one's name -- a server rolling its practice.
        epoch += 1;
        change = 'clock';
      } else if (
        nextLaps !== undefined &&
        laps !== undefined &&
        nextLaps < laps
      ) {
        // Same reasoning on the lap count, which catches a roll whose clock
        // happens to land near where the last one ended.
        epoch += 1;
        change = 'laps';
      }

      // Adopted unconditionally, so the lower values after a roll become the
      // new baseline instead of re-triggering on every tick.
      elapsed = nextElapsed;
      if (nextLaps !== undefined) laps = nextLaps;
      if (nextEvents !== undefined) events = nextEvents;
      if (change) recompute();
      return id;
    },

    current() {
      return id;
    },

    lastChange() {
      return change;
    },

    reset() {
      stamp = null;
      elapsed = 0;
      laps = undefined;
      events = undefined;
      epoch = 0;
      id = 0;
      change = null;
    },
  };
};
