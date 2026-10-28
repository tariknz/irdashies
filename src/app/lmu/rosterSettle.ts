/**
 * Holds a session rebuild back while the grid is still filling.
 *
 * LMU admits drivers one per session poll, so a twenty-car grid loading in is
 * twenty roster changes half a second apart. Each one rebuilt the whole
 * snapshot and structured-cloned it to every overlay window, and that burst is
 * where the sim visibly hitches.
 *
 * So a roster change starts a settling window instead of a rebuild. Further
 * changes extend it, and the rebuild happens once the roster has held still --
 * which turns twenty rebuilds into one, or into a handful for a grid that
 * takes longer than the cap to fill.
 *
 * `maxWaitMs` is what makes that safe. Without it a grid admitting a driver
 * every half second would reset the window forever and the standings would
 * stay empty for as long as it took to load. With it the wait is bounded, so
 * the worst case is a rebuild every `maxWaitMs` rather than never.
 *
 * Only the roster is gated. A change to anything else -- a position, a lap
 * time, the weather -- rebuilds immediately as it always did, because those
 * arrive steadily rather than in bursts and delaying them would make the
 * standings lag the race.
 */

/** Long enough to swallow the half-second gap between two joins. */
export const ROSTER_SETTLE_MS = 750;

/** The longest the standings may be held back while a grid fills. */
export const ROSTER_MAX_WAIT_MS = 2000;

export interface RosterGate {
  /**
   * Whether a rebuild should wait.
   *
   * Call once per session poll with the current roster signature. Returns true
   * while the roster is still settling and false when it is time to rebuild.
   */
  shouldWait(roster: string, now: number): boolean;
  /** Forgets the roster, so the next poll is treated as the first. */
  reset(): void;
}

export function createRosterGate(
  settleMs: number = ROSTER_SETTLE_MS,
  maxWaitMs: number = ROSTER_MAX_WAIT_MS
): RosterGate {
  let lastRoster: string | undefined;
  /** When the roster last changed, which is what the window extends from. */
  let changedAt: number | null = null;
  /** When the current burst began, which is what the cap measures. */
  let burstStartedAt: number | null = null;

  return {
    shouldWait(roster, now) {
      if (lastRoster === undefined) {
        // The first roster seen is not a change: there is no burst to wait
        // out, and holding the first snapshot back would leave the standings
        // empty for a session that was already fully joined.
        lastRoster = roster;
        return false;
      }

      if (roster !== lastRoster) {
        lastRoster = roster;
        changedAt = now;
        burstStartedAt ??= now;
      }

      if (changedAt === null) return false;

      const settled = now - changedAt >= settleMs;
      const capped =
        burstStartedAt !== null && now - burstStartedAt >= maxWaitMs;
      if (settled || capped) {
        changedAt = null;
        burstStartedAt = null;
        return false;
      }
      return true;
    },

    reset() {
      lastRoster = undefined;
      changedAt = null;
      burstStartedAt = null;
    },
  };
}
