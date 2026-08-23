/** One decoded lap crossing for a single car. */
export interface LapCrossing {
  lap: number;
  sessionTime: number;
  classPosition: number;
  inPit: boolean;
  offTrack: boolean;
  lapped: boolean;
}

export type LapGraphMode = 'trace' | 'position' | 'gap';

export interface LapPoint {
  lap: number;
  value: number;
}
