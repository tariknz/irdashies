export const DEMO_HEART_RATE_INTERVAL_MS = 1000;

export const demoHeartRate = (tick: number) =>
  126 + Math.round(Math.sin(tick / 3) * 6);
