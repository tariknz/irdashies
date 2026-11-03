import { nextProfileIndex } from '@irdashies/shared';
import {
  isActiveSimulator,
  isProfileAssignedToGame,
  profileIdForGame,
  SIMULATOR_IDS,
  type ActiveSimulator,
  type GameProfileAssignments,
  type SimulatorPreference,
} from '@irdashies/types';

/** A sim process the watcher has already identified. */
export interface SimProcessSnapshot {
  id: ActiveSimulator;
  /** Process creation time, milliseconds since the Unix epoch. */
  startedAt: number;
}

export interface GameProfileDecision {
  /** The profile whose widgets should be showing. */
  profileId: string;
  /** The game that decision belongs to, or null when none is running. */
  activeGame: ActiveSimulator | null;
}

/**
 * Which widget profile to show for the processes that are running.
 *
 * ponytail: one profile. OverlayManager has a single active layout, so two
 * running games cannot show both widget sets. The earlier process start wins;
 * a second overlay layer would be the upgrade. An exact start-time tie keeps
 * the previous profile when it is one of the running games.
 */
export function resolveActiveGameProfile(input: {
  processes: readonly SimProcessSnapshot[];
  previousProfileId: string;
  profileIds: Partial<Record<ActiveSimulator, string>>;
}): GameProfileDecision {
  const byId = new Map<ActiveSimulator, number>();
  for (const process of input.processes) {
    const profileId = input.profileIds[process.id];
    if (!profileId || !Number.isFinite(process.startedAt)) continue;
    const existing = byId.get(process.id);
    if (existing === undefined || process.startedAt < existing) {
      byId.set(process.id, process.startedAt);
    }
  }

  if (byId.size === 0) {
    return { profileId: input.previousProfileId, activeGame: null };
  }

  const running = [...byId.entries()].map(([id, startedAt]) => ({
    id,
    startedAt,
  }));
  const earliest = Math.min(...running.map((process) => process.startedAt));
  const tied = running.filter((process) => process.startedAt === earliest);
  const previous = tied.find(
    (process) => input.profileIds[process.id] === input.previousProfileId
  );
  const winner =
    previous ??
    tied.reduce((best, process) =>
      SIMULATOR_IDS.indexOf(process.id) < SIMULATOR_IDS.indexOf(best.id)
        ? process
        : best
    );

  return {
    profileId: input.profileIds[winner.id] ?? input.previousProfileId,
    activeGame: winner.id,
  };
}

/**
 * Profile each game should load. A stored id is used when that profile still
 * exists and is assigned to the game; otherwise the default profile is used
 * when it exists.
 */
export function gameProfileIdsFor(
  stored: Partial<Record<ActiveSimulator, string>> | undefined,
  profileExists: (profileId: string) => boolean,
  assignments: GameProfileAssignments
): Partial<Record<ActiveSimulator, string>> {
  const ids: Partial<Record<ActiveSimulator, string>> = {};
  for (const game of SIMULATOR_IDS) {
    const id = profileIdForGame(
      game,
      stored?.[game],
      profileExists,
      assignments
    );
    if (id) ids[game] = id;
  }
  return ids;
}

/**
 * Profile to load when the headline simulator changes.
 * Auto leaves the current profile alone. A named game uses that game's
 * resolved default: the stored one when it still exists and is assigned,
 * otherwise the default profile.
 */
export function profileIdForSimulatorChoice(
  selected: SimulatorPreference,
  stored: Partial<Record<ActiveSimulator, string>> | undefined,
  profileExists: (profileId: string) => boolean,
  assignments: GameProfileAssignments
): string | undefined {
  if (!isActiveSimulator(selected)) return undefined;
  return gameProfileIdsFor(stored, profileExists, assignments)[selected];
}

/**
 * Profile the keyboard shortcut should switch to, or null to stay put.
 *
 * No running game walks every profile. A running game walks profiles assigned
 * to it, in the given order. The current profile sitting outside that set
 * steps to the first on next and the last on previous.
 */
export function nextCycledProfileId(input: {
  profileIds: readonly string[];
  currentId: string;
  direction: 1 | -1;
  cycle: boolean;
  runningGame: ActiveSimulator | null;
  assignments: GameProfileAssignments;
}): string | null {
  if (input.runningGame === null) {
    if (input.profileIds.length < 2) return null;
    return idAt(
      input.profileIds,
      input.profileIds.indexOf(input.currentId),
      input.direction,
      input.cycle,
      input.currentId
    );
  }

  const game = input.runningGame;
  const pool = input.profileIds.filter((id) =>
    isProfileAssignedToGame(id, game, input.assignments)
  );
  if (pool.length === 0) return null;

  const currentIndex = pool.indexOf(input.currentId);
  if (currentIndex === -1) {
    return input.direction === 1 ? pool[0] : pool[pool.length - 1];
  }

  return idAt(
    pool,
    currentIndex,
    input.direction,
    input.cycle,
    input.currentId
  );
}

const idAt = (
  pool: readonly string[],
  currentIndex: number,
  direction: 1 | -1,
  cycle: boolean,
  currentId: string
): string | null => {
  const targetIndex = nextProfileIndex(
    currentIndex,
    pool.length,
    direction,
    cycle
  );
  if (targetIndex === -1) return null;
  const target = pool[targetIndex];
  if (!target || target === currentId) return null;
  return target;
};
