export interface PitLaneTrackData {
  pitEntryPct: number | null;
  pitExitPct: number | null;
}

export interface PitLaneBridge {
  getPitLaneData: (trackId: string) => Promise<PitLaneTrackData | null>;
  updatePitLaneData: (trackId: string, data: Partial<PitLaneTrackData>) => Promise<void>;
}
