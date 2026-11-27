export interface ReplayDirectorBridge {
  /**
   * Seek to the advancing Live clock and play at normal speed.
   * No-op if not cut away.
   */
  backToProgram: () => Promise<void>;
  /**
   * Seek to the frozen Cutaway departure, reset Live to that time, and clear
   * Cutaway. No-op if not cut away.
   */
  resumeAtCut: () => Promise<void>;
  /**
   * Promote the current playhead position to the new program line without
   * seeking. No-op if not cut away.
   */
  stayHere: () => Promise<void>;
}
