/**
 * LMU / rF2 `mPitState` codes, as TinyPedal reads them for pit request.
 *
 * 0 none, 1 requested, 2 entering, 3 stopped, 4 exiting.
 */
export const LMU_PIT_STATE = {
  none: 0,
  requested: 1,
  entering: 2,
  stopped: 3,
  exiting: 4,
} as const;

export const lmuPitRequested = (code: number | undefined): boolean =>
  code === LMU_PIT_STATE.requested;
