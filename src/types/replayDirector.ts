export interface ReplayDirectorBridge {
  /**
   * Seek the replay to where the program line would be now, then restore the
   * camera and play speed from the cut cue. No-op if not cut away.
   */
  backToProgram: () => Promise<void>;
  /**
   * Seek back to the frame the director cut from, then restore its camera and
   * play speed. No-op if not cut away.
   */
  resumeAtCut: () => Promise<void>;
  /**
   * Promote the current playhead position to the new program line without
   * seeking. No-op if not cut away.
   */
  stayHere: () => Promise<void>;
}
