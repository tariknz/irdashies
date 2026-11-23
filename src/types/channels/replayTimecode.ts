export type ProgramState = 'onProgram' | 'cutAway';

export interface ReplayTimecodeSnapshot {
  /**
   * False when no iRacing replay is playing or the source is the tape.
   * Everything else is zeroed when false.
   */
  active: boolean;
  sessionNum: number;
  /** Whole seconds. */
  sessionTime: number;
  frame: number;
  frameEnd: number;
  playSpeed: number;
  slowMotion: boolean;
  /**
   * True while a live session has the playhead within LIVE_EDGE_FRAMES of
   * frameEnd.
   */
  atLiveEdge: boolean;
  program: {
    state: ProgramState;
    sessionNum: number;
    /** Whole seconds. */
    sessionTime: number;
    /** Playhead minus program, 0 on program. */
    offsetSeconds: number;
    /** True if the program line was at the live edge when the director cut. */
    wasLive: boolean;
  };
  version: number;
}
