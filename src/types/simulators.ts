/**
 * The simulators irDashies knows how to name, and the user's choice between
 * them.
 *
 * Knowing about a simulator is not the same as being able to read it: which
 * ones a given build can actually talk to is decided at runtime by the sim
 * registry in the main process, which discovers the source modules present in
 * the tree. This file is the vocabulary shared with the renderer — the ids and
 * the labels — so the settings window can list a simulator and mark it
 * unavailable rather than pretending it does not exist.
 */

/** The simulator the user has pinned, or 'auto' to detect it at runtime. */
export type SimulatorPreference = 'auto' | 'iracing' | 'lmu';

/** A simulator actually selected — 'auto' has been resolved away. */
export type ActiveSimulator = 'iracing' | 'lmu';

/** Human-readable names, used in the settings dropdown and header. */
export const SIMULATOR_LABELS: Record<ActiveSimulator, string> = {
  iracing: 'iRacing',
  lmu: 'Le Mans Ultimate',
};

/** Every known simulator id, in the order the settings dropdown lists them. */
export const SIMULATOR_IDS: ActiveSimulator[] = ['iracing', 'lmu'];

/**
 * Whether a simulator has a driver-rating system at all.
 *
 * A constant property of the simulator, not of each driver, so it is declared
 * once here rather than carried per driver on every frame. iRacing has iRating
 * and a licence; LMU has neither, and its drivers would otherwise be rendered
 * with an empty rating badge.
 */
export const SIMULATOR_HAS_DRIVER_RATINGS: Record<ActiveSimulator, boolean> = {
  iracing: true,
  lmu: false,
};

/**
 * The columns that exist only because a simulator has driver ratings.
 *
 * Shared by the header builder and the row builder, which compute their
 * columns independently: if they disagreed about which ids these are, the
 * header would stop lining up with the cells.
 */
export const RATING_COLUMN_IDS = ['badge', 'iratingChange'] as const;

/**
 * Whether to show rating-derived UI for the running simulator.
 *
 * True when nothing has been detected yet. That matches isWidgetDisabledForSim:
 * with no sim to be incompatible with, hiding would be guessing, and the
 * active simulator deliberately outlives a disconnect.
 */
export const simulatorHasDriverRatings = (
  simulator: ActiveSimulator | null | undefined
): boolean => (simulator ? SIMULATOR_HAS_DRIVER_RATINGS[simulator] : true);

export const isActiveSimulator = (value: unknown): value is ActiveSimulator =>
  typeof value === 'string' && SIMULATOR_IDS.includes(value as ActiveSimulator);

export const isSimulatorPreference = (
  value: unknown
): value is SimulatorPreference => value === 'auto' || isActiveSimulator(value);

/** The display name for a simulator, or null when none is running. */
export const simulatorDisplayName = (
  simulator: ActiveSimulator | null | undefined
): string | null => (simulator ? SIMULATOR_LABELS[simulator] : null);

/**
 * Which game the process watcher last saw, and whether that process is still
 * running. `game` stays set after the process exits so the dashboard can keep
 * showing the last profile instead of going blank.
 */
export interface GameDetectionStatus {
  game: ActiveSimulator | null;
  running: boolean;
}

/**
 * Profile id each game loads when it starts. A missing key, or a stored id
 * that is not assigned to that game, means the default profile.
 */
export type GameProfileDefaults = Partial<Record<ActiveSimulator, string>>;

/**
 * Games a profile is cycled with while that game is running. Keyed by
 * profile id. The default profile is assigned to every game without an
 * entry. A built-in profile whose id equals a game id is assigned to that
 * game without an entry.
 */
export type GameProfileAssignments = Partial<Record<string, ActiveSimulator[]>>;

/** Assigned without a stored row, so the user cannot unassign it. */
export const isProfileAssignmentLocked = (
  profileId: string,
  game: ActiveSimulator
): boolean => profileId === 'default' || profileId === game;

export const isProfileAssignedToGame = (
  profileId: string,
  game: ActiveSimulator,
  assignments: GameProfileAssignments | undefined
): boolean =>
  isProfileAssignmentLocked(profileId, game) ||
  (assignments?.[profileId]?.includes(game) ?? false);

/** Stored id when it still exists and is assigned; otherwise the default profile. */
export const profileIdForGame = (
  game: ActiveSimulator,
  stored: string | undefined,
  profileExists: (profileId: string) => boolean,
  assignments: GameProfileAssignments | undefined
): string | undefined => {
  if (
    stored &&
    profileExists(stored) &&
    isProfileAssignedToGame(stored, game, assignments)
  ) {
    return stored;
  }
  return profileExists('default') ? 'default' : undefined;
};
