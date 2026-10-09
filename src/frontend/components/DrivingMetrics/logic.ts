import type { FuelLapData, TrackNote } from '@irdashies/types';

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

export function noteIsTriggered(
  note: TrackNote,
  lapDistPct: number,
  previousLapDistPct: number,
  tolerancePct: number,
  onPitRoad: boolean
) {
  if (note.scope === 'pit' && !onPitRoad) return false;
  if (note.scope === 'session' && onPitRoad) return false;
  const target = note.lapDistPct;
  const crossed =
    previousLapDistPct <= lapDistPct
      ? target > previousLapDistPct && target <= lapDistPct
      : target > previousLapDistPct || target <= lapDistPct;
  const distance = Math.min(
    Math.abs(lapDistPct - target),
    1 - Math.abs(lapDistPct - target)
  );
  return crossed || distance <= tolerancePct;
}

export interface AccelerationWindow {
  fromKph: number;
  toKph: number;
}

export interface AccelerationTimerState {
  startedAt: number | null;
  elapsed: number | null;
  armed: boolean;
}

export function updateAccelerationTimer(
  state: AccelerationTimerState,
  window: AccelerationWindow,
  speedKph: number,
  sessionTime: number,
  gear: number
): AccelerationTimerState {
  if (gear < 0 || speedKph <= Math.max(0.5, window.fromKph - 2)) {
    return { startedAt: null, elapsed: null, armed: true };
  }
  if (state.armed && state.startedAt === null && speedKph >= window.fromKph) {
    return {
      startedAt: sessionTime,
      elapsed: null,
      armed: false,
    };
  }
  if (state.startedAt !== null && speedKph >= window.toKph) {
    return {
      startedAt: null,
      elapsed: Math.max(0, sessionTime - state.startedAt),
      armed: false,
    };
  }
  return state;
}

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
  for (const lap of laps.filter((item) => !item.isHistorical)) {
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
  return groups.filter((group) => group.length > 0).map((group) => {
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
