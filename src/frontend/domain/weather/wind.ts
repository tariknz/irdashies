export interface WindDemoData {
  speedMs: number;
  direction: number;
}

const WIND_DEMO_VALUES = [
  { speed: 2, direction: 0 },
  { speed: 8, direction: Math.PI * 0.25 },
  { speed: 20, direction: Math.PI * 0.75 },
  { speed: 35, direction: Math.PI * 1.25 },
  { speed: 44, direction: Math.PI * 1.75 },
];

export const WIND_DEMO_INTERVAL_MS = 1500;

export const getDemoWindData = (
  index: number,
  metric: boolean
): WindDemoData => {
  const demoValue = WIND_DEMO_VALUES[index % WIND_DEMO_VALUES.length];
  const speedMs = demoValue.speed / (metric ? 3.6 : 2.23694);

  return {
    speedMs,
    direction: demoValue.direction,
  };
};

export const getWindIntensityClass = (speed?: number) => {
  if (speed === undefined) return 'text-white';
  if (speed < 5) return 'text-white';
  if (speed < 15) return 'text-sky-300';
  if (speed < 30) return 'text-emerald-300';
  if (speed < 40) return 'text-orange-300';

  return 'text-red-400';
};
