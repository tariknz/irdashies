import type {
  RacePlanAvailability,
  RacePlanProgressSnapshot,
  RacePlanProjectedStint,
  RacePlanState,
  RacePlanStop,
  RacePlanning,
} from '@irdashies/types';

/**
 * A made-up 24h race plan for previews, stories and specs: six drivers
 * (Driver A to F, ids 101 to 106), 23 one-hour stints of 34 laps.
 */
export const DEMO_RACE_START_MS = Date.parse('2030-06-01T12:00:00Z');
export const DEMO_DRIVER_IDS = [101, 102, 103, 104, 105, 106] as const;
export const DEMO_STINT_SEC = 3710;
export const DEMO_STINT_LAPS = 34;
const LAP_SEC = 105;
const STINTS = 23;

const at = (iso: string) => Date.parse(iso);

const window = (
  status: RacePlanAvailability['status'],
  from: string,
  to: string
): RacePlanAvailability => ({ status, startMs: at(from), endMs: at(to) });

/** Driver E is out from 23:30 UTC and Driver F maybe from 00:30, so a late race clashes. */
const AVAILABILITY: Record<number, RacePlanAvailability[]> = {
  105: [window('unavailable', '2030-06-01T23:30:00Z', '2030-06-02T04:00:00Z')],
  106: [window('maybe', '2030-06-02T00:30:00Z', '2030-06-02T02:00:00Z')],
};

const plannedDriver = (number: number) =>
  DEMO_DRIVER_IDS[(number - 1) % DEMO_DRIVER_IDS.length];

export const demoRacePlanning: RacePlanning = {
  source: 'iraceplan',
  id: 9001,
  sessionName: 'Test 24',
  car: 'Test Car',
  teamId: 5001,
  trackId: 166,
  trackName: 'Test Circuit',
  updatedAt: '2030-05-02T12:00:00Z',
  drivers: DEMO_DRIVER_IDS.map((iracingId, i) => ({
    iracingId,
    name: `Driver ${String.fromCharCode(65 + i)}`,
    availability: AVAILABILITY[iracingId] ?? [],
  })),
  strategies: [
    {
      id: 7001,
      name: 'Main',
      raceStartMs: DEMO_RACE_START_MS,
      fuelCapacity: 36,
      pitStopMs: 50_000,
      updatedAt: '2030-05-02T12:00:00Z',
      drivers: [],
      stints: Array.from({ length: STINTS }, (_, i) => ({
        number: i + 1,
        driverId: plannedDriver(i + 1),
        startSec: i * DEMO_STINT_SEC,
        endSec: i * DEMO_STINT_SEC + 3660,
        laps: DEMO_STINT_LAPS,
        setup: 'dry' as const,
        fuel: 35.7,
        locked: false,
      })),
    },
  ],
};

export const demoRacePlanState: RacePlanState = {
  config: { planningId: 9001, strategyId: 7001, refreshMinutes: 5 },
  hasApiKey: true,
  canStoreApiKey: true,
  status: 'ok',
  fetchedAt: DEMO_RACE_START_MS,
  planning: demoRacePlanning,
  strategyId: 7001,
};

export interface DemoSnapshotOptions {
  status?: RacePlanProgressSnapshot['status'];
  /** Stint number in the car; ignored unless racing or finished. */
  currentStint?: number;
  lapsInStint?: number;
  driftSec?: number;
  fuelVisible?: boolean;
  fuelPerLap?: number;
  /** Stints from this number on were rebuilt after a stop. */
  rebuiltFrom?: number;
  /** Add an extra stint at the end that the plan has no driver for. */
  unassignedExtra?: boolean;
  /** The last planned stint no longer fits. */
  dropLast?: boolean;
  stops?: RacePlanStop[];
  mismatches?: RacePlanProgressSnapshot['mismatches'];
}

const statusFor = (
  number: number,
  current: number | null,
  finished: boolean
): RacePlanProjectedStint['status'] => {
  if (current === null) return 'upcoming';
  if (number < current || (finished && number === current)) return 'done';
  return number === current ? 'current' : 'upcoming';
};

/** An unplanned repair stop with no fuel and no driver change. */
export const demoRepairStop: RacePlanStop = {
  lap: 60,
  elapsedSec: 6400,
  durationSec: 95,
  fuelAdded: 0,
  fuelAssumed: false,
  driverChanged: false,
  compoundChanged: false,
  unplanned: true,
};

export const demoRacePlanSnapshot = ({
  status = 'racing',
  currentStint = 4,
  lapsInStint = 12,
  driftSec = 0,
  fuelVisible = true,
  fuelPerLap = 1.04,
  rebuiltFrom,
  unassignedExtra = false,
  dropLast = false,
  stops = [],
  mismatches = [],
}: DemoSnapshotOptions = {}): RacePlanProgressSnapshot => {
  const racing = status === 'racing' || status === 'finished';
  const current = racing ? currentStint : null;
  const shift = (number: number) =>
    current !== null && number >= current ? driftSec : 0;

  const stints: RacePlanProjectedStint[] = Array.from(
    { length: STINTS },
    (_, i) => {
      const number = i + 1;
      const plannedStartSec = i * DEMO_STINT_SEC;
      const startSec = plannedStartSec + shift(number);
      return {
        number,
        planNumber: number,
        driverId: plannedDriver(number),
        plannedStartSec,
        plannedEndSec: plannedStartSec + 3660,
        startSec,
        endSec: startSec + 3660,
        startLap: i * DEMO_STINT_LAPS,
        laps: DEMO_STINT_LAPS,
        status: statusFor(number, current, status === 'finished'),
        setup: 'dry',
        rebuilt: rebuiltFrom !== undefined && number >= rebuiltFrom,
      };
    }
  );
  if (dropLast) stints[STINTS - 1].status = 'dropped';
  if (unassignedExtra) {
    const last = stints[STINTS - 1];
    stints.push({
      ...last,
      number: STINTS + 1,
      planNumber: null,
      driverId: null,
      plannedStartSec: null,
      plannedEndSec: null,
      startSec: last.endSec + 50,
      endSec: last.endSec + 50 + 1800,
      startLap: last.startLap + DEMO_STINT_LAPS,
      laps: 17,
      status: 'unassigned',
      rebuilt: true,
    });
  }

  const stint = current === null ? null : stints[current - 1];
  const teamLaps = stint ? stint.startLap + lapsInStint : 0;
  const boxLap = stint ? stint.startLap + DEMO_STINT_LAPS : null;
  return {
    status,
    planningId: demoRacePlanning.id,
    strategyId: 7001,
    planUpdatedAt: '2030-05-02T12:00:00Z',
    mismatches,
    raceStartMs: DEMO_RACE_START_MS,
    elapsedSec: stint ? stint.startSec + 60 + lapsInStint * LAP_SEC : -900,
    teamLaps,
    driverId: stint?.driverId ?? null,
    currentStintIndex: current === null ? null : current - 1,
    lapsInStint: stint ? lapsInStint : 0,
    boxLap,
    lapsUntilBox: boxLap === null ? null : Math.max(0, boxLap - teamLaps - 1),
    fuelLevel: fuelVisible && stint ? 36 - lapsInStint * fuelPerLap : null,
    fuelVisible,
    fuelPerLap: fuelVisible ? fuelPerLap : null,
    lapTimeSec: LAP_SEC,
    conditions: 'dry',
    driftSec: racing ? driftSec : null,
    stints,
    stops,
    version: 1,
  };
};
