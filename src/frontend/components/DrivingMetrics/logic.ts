import type { FuelLapData } from '@irdashies/types';

export const STANDARD_GRAVITY = 9.80665;

export function mapGForce(
  lateralAccel: number | undefined,
  longitudinalAccel: number | undefined
) {
  return {
    lateral: Number.isFinite(lateralAccel)
      ? (lateralAccel as number) / STANDARD_GRAVITY
      : null,
    longitudinal: Number.isFinite(longitudinalAccel)
      ? (longitudinalAccel as number) / STANDARD_GRAVITY
      : null,
  };
}

export interface StintSummary {
  sessionNum: number | undefined;
  firstLap: number;
  lastLap: number;
  laps: number;
  duration: number;
  fuelUsed: number;
  averageLap: number;
  consistency: number;
}

export function groupStints(laps: readonly FuelLapData[]): StintSummary[] {
  const groups: FuelLapData[][] = [];
  const chronological = laps
    .filter((item) => !item.isHistorical)
    .sort((a, b) => a.timestamp - b.timestamp || a.lapNumber - b.lapNumber);
  for (const lap of chronological) {
    if (
      groups.length === 0 ||
      lap.isOutLap ||
      groups.at(-1)?.at(-1)?.isInLap ||
      groups.at(-1)?.at(-1)?.wasTowed ||
      groups.at(-1)?.at(-1)?.sessionNum !== lap.sessionNum
    ) {
      groups.push([]);
    }
    groups.at(-1)?.push(lap);
  }
  return groups
    .filter((group) => group.length > 0)
    .map((group) => {
      const times = group.map((lap) => lap.lapTime).filter((time) => time > 0);
      const averageLap =
        times.reduce((sum, time) => sum + time, 0) / Math.max(1, times.length);
      const variance =
        times.reduce((sum, time) => sum + (time - averageLap) ** 2, 0) /
        Math.max(1, times.length);
      return {
        sessionNum: group[0].sessionNum,
        firstLap: group[0].lapNumber,
        lastLap: group.at(-1)?.lapNumber ?? group[0].lapNumber,
        laps: group.length,
        duration: times.reduce((sum, time) => sum + time, 0),
        fuelUsed: group.reduce((sum, lap) => sum + lap.fuelUsed, 0),
        averageLap,
        consistency: Math.sqrt(variance),
      };
    });
}

export function integrateDistance(
  previousMeters: number,
  speedMps: number,
  deltaSeconds: number
) {
  return Number.isFinite(speedMps) &&
    Number.isFinite(deltaSeconds) &&
    deltaSeconds > 0 &&
    deltaSeconds < 2
    ? previousMeters + Math.max(0, speedMps) * deltaSeconds
    : previousMeters;
}
