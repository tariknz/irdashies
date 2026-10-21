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

/** The display name for a simulator, or null when none is running. */
export const simulatorDisplayName = (
  simulator: ActiveSimulator | null | undefined
): string | null => (simulator ? SIMULATOR_LABELS[simulator] : null);
