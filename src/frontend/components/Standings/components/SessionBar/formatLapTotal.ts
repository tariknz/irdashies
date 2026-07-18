export const formatLapTotal = (laps: number) =>
  laps.toFixed(1).replace(/\.0$/, '');
