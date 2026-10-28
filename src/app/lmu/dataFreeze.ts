/**
 * Notices when LMU stops writing shared memory.
 *
 * Ending a practice session does not close the sim, unmap the block or change
 * anything in it -- it simply stops being written. The last snapshot stays
 * readable with `mInRealtime` true and a valid player slot, so irdashies kept
 * reading it and every widget gated on being in the car stayed on screen
 * indefinitely.
 *
 * TinyPedal's answer, which does detect this: require the data to be flowing
 * before calling the player active.
 *
 * ```python
 * return self._sync.synced and self._sync.player_scor_index >= 0 and (
 *     self.lmuScorInfo.mInRealtime
 *     or self.lmuTeleVeh().mIgnitionStarter > 0
 * )
 * ```
 *
 * `synced` is false whenever its own watchdog has seen the session timestamp
 * stand still for two seconds. We had the other two conditions and not this
 * one, which is the whole difference.
 *
 * Keyed on the sim's own scoring write counter first and the session clock
 * second. The counter is the better signal: a session paused in the garage has
 * a still clock and a sim that is still writing, and only the counter tells
 * those apart.
 */

/**
 * How long nothing may move before the data is called frozen.
 *
 * TinyPedal's number. It is also two seconds of stale overlay after a session
 * ends, which is the cost of not flapping on a brief hitch -- scoring
 * publishes at 5 Hz, so a handful of missed writes is ordinary.
 */
export const FREEZE_AFTER_MS = 2000;

export interface LmuDataFreezeSample {
  /** The sim's scoring write counter. Monotonic while it is writing. */
  scoringUpdates?: number;
  /** Seconds into the session. Moves whenever the session is running. */
  currentET?: number;
}

export interface LmuDataFreeze {
  /**
   * Takes a reading and returns whether the data is frozen.
   *
   * Called once per loop iteration, before the mappers, because what it
   * decides feeds the in-car state they publish.
   */
  observe(sample: LmuDataFreezeSample, now: number): boolean;
  frozen(): boolean;
  /** True on the observation that changed it, for the caller to log. */
  justChanged(): boolean;
  reset(): void;
}

export const createLmuDataFreeze = (): LmuDataFreeze => {
  let lastUpdates: number | undefined;
  let lastET: number | undefined;
  let movedAt: number | null = null;
  let isFrozen = false;
  let changed = false;

  return {
    observe(sample, now) {
      const updates = sample.scoringUpdates;
      const et = sample.currentET;
      const moved =
        (typeof updates === 'number' && updates !== lastUpdates) ||
        (typeof et === 'number' && et !== lastET);

      lastUpdates = updates;
      lastET = et;

      changed = false;
      if (moved || movedAt === null) {
        // The first observation starts the clock rather than counting as
        // stillness: nothing has had a chance to move yet.
        movedAt = now;
        if (isFrozen) {
          isFrozen = false;
          changed = true;
        }
        return isFrozen;
      }

      if (!isFrozen && now - movedAt >= FREEZE_AFTER_MS) {
        isFrozen = true;
        changed = true;
      }
      return isFrozen;
    },

    frozen() {
      return isFrozen;
    },

    justChanged() {
      return changed;
    },

    reset() {
      lastUpdates = undefined;
      lastET = undefined;
      movedAt = null;
      isFrozen = false;
      changed = false;
    },
  };
};
