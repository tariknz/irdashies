export const DEMO_DELTA_INTERVAL_MS = 100;

export const demoDeltaKph = (tick: number) =>
  tick === 0 ? 4.2 : Math.sin(tick / 8) * 9;
