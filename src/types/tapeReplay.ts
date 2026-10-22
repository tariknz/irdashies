/** Transport time is seconds since the start of the tape, not SessionTime. */
export interface TapeReplayStatus {
  position: number;
  duration: number;
  speed: number;
  paused: boolean;
  ended: boolean;
}

export const TAPE_REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 5, 10] as const;

export type TapeReplayCommand =
  | { type: 'seek'; seconds: number }
  | { type: 'speed'; speed: number }
  | { type: 'pause'; paused: boolean };

/** Available only for the in-process iRacing tape transport. */
export interface TapeReplayBridge {
  getStatus: () => Promise<TapeReplayStatus | null>;
  command: (command: TapeReplayCommand) => Promise<TapeReplayStatus>;
}
