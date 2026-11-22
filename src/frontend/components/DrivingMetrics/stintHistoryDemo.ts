import type { FuelLapData } from '@irdashies/types';

/** Synthetic completed laps that group into a few advancing stints. */
export const getDemoStintLaps = (elapsedSec = 0): FuelLapData[] => {
  const stintShift = Math.floor(elapsedSec / 20);
  const laps: FuelLapData[] = [];
  for (let stint = 0; stint < 3; stint++) {
    const firstLap = 1 + stint * 12 + stintShift;
    for (let i = 0; i < 10; i++) {
      const lapNumber = firstLap + i;
      laps.push({
        lapNumber,
        sessionNum: 0,
        timestamp: lapNumber * 90_000 + Math.floor(elapsedSec * 1000),
        fuelUsed: Number(
          (2.2 + Math.sin(elapsedSec * 0.3 + i) * 0.15).toFixed(2)
        ),
        lapTime: 90 + Math.sin(elapsedSec * 0.2 + i) * 0.8,
        isGreenFlag: true,
        isValidForCalc: true,
        isOutLap: false,
        isHistorical: false,
      });
    }
  }
  return laps;
};
