/**
 * - `live`: the sim is running a session, with nobody's replay loaded.
 * - `spectating`: live, but the sim is playing back (IsReplayPlaying).
 * - `replayFile`: an iRacing replay file (.rpy) is loaded.
 */
export type ReplayMode = 'live' | 'spectating' | 'replayFile';

/**
 * Where a loaded replay's event history can come from. Always `none` outside
 * `replayFile` mode.
 * - `archived`: irDashies recorded this event on this PC.
 * - `localNotArchived`: this PC's user recorded it, but nothing was archived.
 * - `foreign`: the replay came from another computer.
 */
export type ReplayProvenance =
  'none' | 'archived' | 'localNotArchived' | 'foreign';

export interface ReplayContextSnapshot {
  mode: ReplayMode;
  provenance: ReplayProvenance;
  subSessionId: string;
  /** Session numbers with archived incidents or lap history. */
  archivedSessionNums: readonly number[];
  version: number;
}
