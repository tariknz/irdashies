import { isLmuAiEntry, lmuPlayerSlot } from './aiControl';

/**
 * When to ask LMU for the grid's nationalities, and when the asking is done.
 *
 * The sim lists a driver in `/rest/multiplayer/teams` before it has their
 * country: the nationality arrives empty and is filled in a little later. So
 * the payload is worth asking for only around a driver arriving, and only
 * until every driver has a flag. This watches the grid for the first half and
 * answers the second; the REST poller does the asking, in a burst the bridge
 * starts. See the teams task in rest/tasks.ts.
 *
 * Online only. An offline session has no nationalities to fetch, and its AI
 * are named after real people, so a flag found for one would be a stranger's.
 */

/**
 * How long after a driver appears before asking. The teams payload trails the
 * grid, and a grid filling in admits one driver per session poll, so a burst
 * started at once would be started over with every arrival.
 */
export const NATIONALITY_JOIN_DELAY_MS = 1000;

interface GridDriver {
  readonly id: number;
  readonly name: string;
  readonly control?: number;
  readonly isPlayer?: boolean;
}

export interface LmuNationalityGrid {
  /** `mGameMode`: 0 offline, non-zero in multiplayer. */
  readonly gameMode?: number;
  readonly drivers: readonly GridDriver[];
  readonly playerHasVehicle?: boolean;
  readonly playerVehicleIdx?: number;
}

export interface LmuNationalityWatch {
  /**
   * Takes a session poll's grid, and returns true when it holds a driver the
   * watch has not seen before -- the cue to start a burst. Always false
   * offline.
   */
  observe(grid: LmuNationalityGrid): boolean;
  /** Whether every driver on the last online grid has a flag in `codes`. */
  complete(codes: Readonly<Record<string, string>> | undefined): boolean;
  /** Forgets every driver, for a new event or a disconnect. */
  reset(): void;
}

export const createLmuNationalityWatch = (): LmuNationalityWatch => {
  const seen = new Set<string>();
  let names: string[] = [];

  return {
    /** True when the grid names a driver not seen before; false offline. */
    observe(grid) {
      if ((grid.gameMode ?? 0) === 0) {
        // Leaving multiplayer forgets the grid, so joining another server
        // asks again even if the same people are on it.
        seen.clear();
        names = [];
        return false;
      }
      const ownSlot = lmuPlayerSlot(grid);
      names = grid.drivers
        .filter(
          (driver) =>
            driver.name.length > 0 &&
            // The same test the rating lookup uses: an AI entry has no
            // nationality to wait for. See gridUsernames in lmuSdkBridge.ts.
            !isLmuAiEntry({
              control: driver.control,
              isPlayer: driver.isPlayer || driver.id === ownSlot,
            })
        )
        .map((driver) => driver.name);
      let arrived = false;
      for (const name of names) {
        if (seen.has(name)) continue;
        seen.add(name);
        arrived = true;
      }
      return arrived;
    },

    /** Whether every driver on the last online grid has a flag. */
    complete(codes) {
      return (
        names.length > 0 && names.every((name) => codes?.[name] !== undefined)
      );
    },

    reset() {
      seen.clear();
      names = [];
    },
  };
};
