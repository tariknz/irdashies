/**
 * An endurance race plan from a planning tool, in a source-neutral shape.
 * Only iRacePlan is supported today; its API shape stays in the main process.
 */

export type RacePlanAvailabilityStatus = 'available' | 'maybe' | 'unavailable';

export interface RacePlanAvailability {
  status: RacePlanAvailabilityStatus;
  /** Epoch milliseconds. */
  startMs: number;
  /** Epoch milliseconds. */
  endMs: number;
}

export interface RacePlanDriver {
  /** iRacing customer id. */
  iracingId: number;
  name: string;
  availability: RacePlanAvailability[];
}

/** A driver's pace and fuel figures, as one strategy assumes them. */
export interface RacePlanDriverFigures {
  iracingId: number;
  avgLapMsDry: number | null;
  avgLapMsWet: number | null;
  /** Litres per lap. */
  fuelPerLapDry: number | null;
  /** Litres per lap. */
  fuelPerLapWet: number | null;
}

export type RacePlanSetup = 'dry' | 'wet';

export interface RacePlanStint {
  number: number;
  /** iRacing customer id, or null when the stint has no driver yet. */
  driverId: number | null;
  /** Seconds since the strategy's race start. */
  startSec: number;
  /** Seconds since the strategy's race start. */
  endSec: number;
  /** Pinned laps when set, otherwise the tool's estimate. */
  laps: number;
  setup: RacePlanSetup;
  /** Litres used over the stint, when the tool gives it. */
  fuel: number | null;
  locked: boolean;
}

export interface RacePlanStrategy {
  id: number;
  name: string;
  /** Epoch milliseconds. */
  raceStartMs: number;
  /** Litres, when known. */
  fuelCapacity: number | null;
  pitStopMs: number | null;
  /** ISO time the strategy was last edited in the planning tool. */
  updatedAt: string;
  drivers: RacePlanDriverFigures[];
  stints: RacePlanStint[];
}

export interface RacePlanning {
  source: 'iraceplan';
  id: number;
  sessionName: string;
  car: string | null;
  /** iRacing team id the planning was made for, when it is a team plan. */
  teamId: number | null;
  /** iRacing track id. */
  trackId: number | null;
  trackName: string | null;
  /** ISO time the planning itself was last edited. */
  updatedAt: string;
  drivers: RacePlanDriver[];
  strategies: RacePlanStrategy[];
}

export interface RacePlanListing {
  id: number;
  name: string;
  car: string | null;
  isTeam: boolean;
  trackName: string | null;
  /** ISO start of the event, when given. */
  startAt: string | null;
}

/** Outcome of the last request to the planning tool. */
export type RacePlanFetchStatus =
  'idle' | 'ok' | 'unauthorized' | 'not-found' | 'network' | 'invalid-response';

export const RACE_PLAN_REFRESH_MINUTES = { min: 1, max: 30, default: 5 };

export interface RacePlanConfig {
  planningId: number | null;
  /** Null means the planning's first strategy. */
  strategyId: number | null;
  refreshMinutes: number;
}

/** Renderer-safe state. The API key never leaves the main process. */
export interface RacePlanState {
  config: RacePlanConfig;
  hasApiKey: boolean;
  /** False when the OS cannot encrypt the key, so it cannot be saved. */
  canStoreApiKey: boolean;
  status: RacePlanFetchStatus;
  /** Epoch milliseconds of the last successful fetch. */
  fetchedAt: number | null;
  planning: RacePlanning | null;
  /** The configured strategy, or the first one when none is chosen. */
  strategyId: number | null;
}

export type RacePlanFetchError = Exclude<RacePlanFetchStatus, 'ok' | 'idle'>;

export type RacePlanListResult =
  | { status: 'ok'; plannings: RacePlanListing[] }
  | { status: RacePlanFetchError };

/** A planning is only switched to once it has loaded. */
export type RacePlanChooseResult =
  { status: 'ok'; state: RacePlanState } | { status: RacePlanFetchError };

export type RacePlanConfigPatch = Partial<
  Pick<RacePlanConfig, 'strategyId' | 'refreshMinutes'>
>;

export interface RacePlanBridge {
  getState(): Promise<RacePlanState>;
  /** Null stops following a planning. */
  choosePlanning(planningId: number | null): Promise<RacePlanChooseResult>;
  setConfig(config: RacePlanConfigPatch): Promise<RacePlanState>;
  setApiKey(apiKey: string): Promise<RacePlanState>;
  clearApiKey(): Promise<RacePlanState>;
  listPlannings(): Promise<RacePlanListResult>;
  refreshNow(): Promise<RacePlanState>;
  /** Returns an unsubscribe function. */
  onStateChanged(callback: (state: RacePlanState) => void): () => void;
}
