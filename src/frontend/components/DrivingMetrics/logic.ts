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

export interface AccelerationWindow {
  fromKph: number;
  toKph: number;
}

export interface AccelerationTimerState {
  startedAt: number | null;
  elapsed: number | null;
  armed: boolean;
  lastSpeedKph: number | null;
  lastTime: number | null;
}

const MOVING_KPH = 0.5;

export const IDLE_ACCELERATION_TIMER: AccelerationTimerState = {
  startedAt: null,
  elapsed: null,
  armed: false,
  lastSpeedKph: null,
  lastTime: null,
};

const crossingTime = (
  state: AccelerationTimerState,
  thresholdKph: number,
  speedKph: number,
  sessionTime: number
) =>
  state.lastSpeedKph !== null &&
  state.lastTime !== null &&
  state.lastSpeedKph < thresholdKph &&
  speedKph > state.lastSpeedKph
    ? state.lastTime +
      ((thresholdKph - state.lastSpeedKph) / (speedKph - state.lastSpeedKph)) *
        (sessionTime - state.lastTime)
    : sessionTime;

export function updateAccelerationTimer(
  state: AccelerationTimerState,
  window: AccelerationWindow,
  speedKph: number,
  sessionTime: number,
  gear: number
): AccelerationTimerState {
  const sample = { lastSpeedKph: speedKph, lastTime: sessionTime };
  if (state.lastTime !== null && sessionTime < state.lastTime) {
    return { startedAt: null, elapsed: state.elapsed, armed: false, ...sample };
  }
  if (gear < 0 || speedKph <= Math.max(MOVING_KPH, window.fromKph - 2)) {
    return { startedAt: null, elapsed: state.elapsed, armed: true, ...sample };
  }
  let { startedAt, elapsed, armed } = state;
  const startKph = Math.max(MOVING_KPH, window.fromKph);
  if (armed && startedAt === null && speedKph >= startKph) {
    startedAt = crossingTime(state, startKph, speedKph, sessionTime);
    elapsed = null;
    armed = false;
  }
  if (startedAt !== null && speedKph >= window.toKph) {
    elapsed = Math.max(
      0,
      crossingTime(state, window.toKph, speedKph, sessionTime) - startedAt
    );
    startedAt = null;
  }
  return { startedAt, elapsed, armed, ...sample };
}

export const runningTime = (
  state: AccelerationTimerState,
  now: number | undefined
): number | null =>
  state.startedAt === null ||
  now === undefined ||
  now < state.startedAt ||
  now - state.startedAt >= 100
    ? null
    : now - state.startedAt;

export interface StintSummary {
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
