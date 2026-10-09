import type { LapHistorySnapshot } from './channels';

export interface LapHistoryBridge {
  /**
   * Lap history this PC recorded for one session of the current event.
   * Resolves null when nothing was archived, or when the loaded replay is not
   * one irDashies recorded.
   */
  getArchived: (sessionNum: number) => Promise<LapHistorySnapshot | null>;
}
