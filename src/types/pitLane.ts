export interface PitLaneTrackData {
  pitEntryPct: number | null;
  pitExitPct: number | null;
}

export interface PitLaneBridge {
  getPitLaneData: (trackId: string) => Promise<PitLaneCalibration>;
  updatePitLaneData: (
    trackId: string,
    data: Partial<PitLaneTrackData>,
    revision: number,
    sourceId: string
  ) => Promise<boolean>;
  getCurrentTrackPitLaneInfo: () => Promise<CurrentTrackPitLaneInfo | null>;
  resetPitLaneData: (trackId: string) => Promise<void>;
  /** Desktop only: open the fixed calibration file in its default application. */
  openPitLaneDataFile?: () => Promise<void>;
  /** Desktop only: apply externally saved calibration edits to all overlays. */
  reloadPitLaneDataFile?: () => Promise<void>;
}

export interface PitLaneCalibration {
  trackId: string;
  /** Main-instance identity; a reconnect may start a new revision sequence. */
  sourceId: string;
  /** Reset generation. Saves from an older generation cannot restore old data. */
  revision: number;
  data: PitLaneTrackData | null;
}

export interface CurrentTrackPitLaneInfo {
  trackId: string;
  trackName: string;
  hasCalibration: boolean;
  /** Native editing workflow pauses automatic saves until a valid reload. */
  learningPaused?: boolean;
}
