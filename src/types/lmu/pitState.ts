export const LMU_PIT_STATE = {
  none: 0,
  requested: 1,
  entering: 2,
  stopped: 3,
  exiting: 4,
} as const;

export const lmuPitRequested = (code: number | undefined): boolean =>
  code === LMU_PIT_STATE.requested;
