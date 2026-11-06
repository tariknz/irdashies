import type {
  PitServiceProfile,
  PitStopRecord,
  PitStopsSnapshot,
} from '@irdashies/types';
import { estimatePitService, type PitServiceEstimate } from './serviceEstimate';

/** What the Pit Stops tab knows about a car from the roster and standings. */
export interface PitCar {
  carIdx: number;
  carNumber: string;
  teamName: string;
  classId: number;
  className: string;
  classColor: number;
  carPath: string;
  /** The lap the car is on now; 0 when not known. */
  lap: number;
  /** 0 when not known. */
  classPosition: number;
  isPlayer: boolean;
}

export interface PitStopRow {
  stop: PitStopRecord;
  car: PitCar | undefined;
  /** 1 for the car's first stop of the session. */
  number: number;
  /** Laps since the car's previous stop, or since the start. */
  stintLaps: number;
  pitLaneSeconds: number;
  stallSeconds: number;
  inProgress: boolean;
  driverChanged: boolean;
  /** Places gained (positive) or lost in class; null until the stop ends. */
  positionChange: number | null;
  estimate: PitServiceEstimate;
}

export interface PitTeamSummary {
  carIdx: number;
  car: PitCar | undefined;
  stops: number;
  pitLaneSeconds: number;
  /** Mean stall time of finished stops that stopped in the stall. */
  averageStallSeconds: number | null;
  averageStintLaps: number | null;
  lastStopLap: number | null;
  lapsSinceStop: number | null;
  /** The lap the car would next stop on at its average stint. */
  nextStopLap: number | null;
  driverChanges: number;
  drivers: string[];
  inPitLane: boolean;
  /** Compared with the player's car; null for the player or with no player. */
  stopsDelta: number | null;
  pitLaneDelta: number | null;
}

/** Driver swaps show as a different roster driver either side of the stop. */
export const isDriverChange = (stop: PitStopRecord): boolean =>
  stop.driverIdIn !== null
    ? stop.driverIdOut !== null && stop.driverIdOut !== stop.driverIdIn
    : stop.driverNameOut !== '' && stop.driverNameOut !== stop.driverNameIn;

/** Seconds of stall time, counting a visit still in progress. */
export const stallSecondsAt = (stop: PitStopRecord, now: number): number =>
  stop.stallSeconds +
  (stop.stallEnteredAt !== null ? Math.max(0, now - stop.stallEnteredAt) : 0);

/** Seconds on pit road, counting a stop still in progress. */
export const pitLaneSecondsAt = (stop: PitStopRecord, now: number): number =>
  Math.max(0, (stop.exitTime ?? now) - stop.entryTime);

/**
 * Every stop with the car's details, its stint length and a service estimate.
 * `now` is the session clock; it ages stops still in progress.
 */
export const buildPitStopRows = (
  snapshot: Pick<PitStopsSnapshot, 'stops'>,
  cars: ReadonlyMap<number, PitCar>,
  profiles: readonly PitServiceProfile[],
  now: number
): PitStopRow[] => {
  const profileFor = new Map(profiles.map((p) => [p.carPath, p]));
  const previousLap = new Map<number, number>();
  const counts = new Map<number, number>();
  return snapshot.stops.map((stop) => {
    const car = cars.get(stop.carIdx);
    const number = (counts.get(stop.carIdx) ?? 0) + 1;
    counts.set(stop.carIdx, number);
    const stintLaps = Math.max(
      0,
      stop.lap - (previousLap.get(stop.carIdx) ?? 0)
    );
    previousLap.set(stop.carIdx, stop.lap);
    const stallSeconds = stallSecondsAt(stop, now);
    const driverChanged = isDriverChange(stop);
    const inProgress = stop.exitTime === null;
    return {
      stop,
      car,
      number,
      stintLaps,
      pitLaneSeconds: pitLaneSecondsAt(stop, now),
      stallSeconds,
      inProgress,
      driverChanged,
      positionChange:
        inProgress || stop.classPositionIn <= 0 || stop.classPositionOut <= 0
          ? null
          : stop.classPositionIn - stop.classPositionOut,
      estimate: estimatePitService({
        stop,
        stallSeconds,
        driverChanged,
        stintLaps,
        profile: car ? profileFor.get(car.carPath) : undefined,
      }),
    };
  });
};

const mean = (values: number[]): number | null =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

/** One row per car that has stopped, compared with the player's car. */
export const summarisePitTeams = (
  rows: readonly PitStopRow[],
  cars: ReadonlyMap<number, PitCar>,
  playerCarIdx: number | null
): PitTeamSummary[] => {
  const byCar = new Map<number, PitStopRow[]>();
  for (const row of rows) {
    const list = byCar.get(row.stop.carIdx);
    if (list) list.push(row);
    else byCar.set(row.stop.carIdx, [row]);
  }
  // A player who has not stopped yet still compares, as zero stops.
  if (
    playerCarIdx !== null &&
    cars.has(playerCarIdx) &&
    !byCar.has(playerCarIdx)
  )
    byCar.set(playerCarIdx, []);

  const summaries = [...byCar].map(([carIdx, stops]): PitTeamSummary => {
    const car = cars.get(carIdx);
    const finished = stops.filter((row) => !row.inProgress);
    const stalled = finished.filter((row) => row.stop.stallTime !== null);
    const stints = stops.map((row) => row.stintLaps).filter((laps) => laps > 0);
    const averageStintLaps = mean(stints);
    const lastStopLap =
      stops.length > 0 ? stops[stops.length - 1].stop.lap : null;
    const drivers: string[] = [];
    for (const row of stops) {
      for (const name of [row.stop.driverNameIn, row.stop.driverNameOut]) {
        if (name && !drivers.includes(name)) drivers.push(name);
      }
    }
    return {
      carIdx,
      car,
      stops: stops.length,
      pitLaneSeconds: stops.reduce((sum, row) => sum + row.pitLaneSeconds, 0),
      averageStallSeconds: mean(stalled.map((row) => row.stallSeconds)),
      averageStintLaps,
      lastStopLap,
      lapsSinceStop:
        lastStopLap !== null && car && car.lap > 0
          ? Math.max(0, car.lap - lastStopLap)
          : null,
      nextStopLap:
        averageStintLaps !== null && lastStopLap !== null
          ? Math.round(lastStopLap + averageStintLaps)
          : null,
      driverChanges: stops.filter((row) => row.driverChanged).length,
      drivers,
      inPitLane: stops.some((row) => row.inProgress),
      stopsDelta: null,
      pitLaneDelta: null,
    };
  });

  const player = summaries.find((summary) => summary.carIdx === playerCarIdx);
  if (player) {
    for (const summary of summaries) {
      if (summary === player) continue;
      summary.stopsDelta = summary.stops - player.stops;
      summary.pitLaneDelta = summary.pitLaneSeconds - player.pitLaneSeconds;
    }
  }
  return summaries;
};
