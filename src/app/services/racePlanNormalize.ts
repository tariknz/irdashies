import type {
  RacePlanAvailability,
  RacePlanAvailabilityStatus,
  RacePlanDriver,
  RacePlanDriverFigures,
  RacePlanListing,
  RacePlanning,
  RacePlanStint,
  RacePlanStrategy,
} from '@irdashies/types';

/** Caps on what one planning may hold; anything beyond is dropped. */
export const RACE_PLAN_LIMITS = {
  drivers: 64,
  strategies: 50,
  stints: 200,
  periods: 200,
  listings: 100,
  text: 200,
};

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asObject = (value: unknown): Raw | null =>
  isObject(value) ? value : null;

const positiveInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;

const nonNegativeInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;

/** A positive finite number; 0 and null mean "not given" in the source. */
const positiveNumber = (value: unknown, max: number): number | null =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= max
    ? value
    : null;

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, RACE_PLAN_LIMITS.text);
  return trimmed.length > 0 ? trimmed : null;
};

const isoTime = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.length > 40) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const list = (value: unknown, cap: number): unknown[] =>
  Array.isArray(value) ? value.slice(0, cap) : [];

const LAP_MS_MAX = 30 * 60_000;
const FUEL_PER_LAP_MAX = 100;
const STINT_FUEL_MAX = 1_000;
const PIT_STOP_MS_MAX = 60 * 60_000;

const AVAILABILITY_STATUSES: readonly RacePlanAvailabilityStatus[] = [
  'available',
  'maybe',
  'unavailable',
];

const normalizePeriod = (value: unknown): RacePlanAvailability | null => {
  const raw = asObject(value);
  if (!raw) return null;
  const status = AVAILABILITY_STATUSES.find((s) => s === raw.status);
  const startMs = isoTime(raw.start_time);
  const endMs = isoTime(raw.end_time);
  if (!status || startMs === null || endMs === null || endMs <= startMs)
    return null;
  return { status, startMs, endMs };
};

const normalizeDrivers = (planning: Raw): RacePlanDriver[] => {
  const drivers = new Map<number, RacePlanDriver>();
  const add = (value: unknown) => {
    const raw = asObject(value);
    const iracingId = positiveInt(raw?.iracing_id);
    if (!iracingId || drivers.has(iracingId)) return;
    if (drivers.size >= RACE_PLAN_LIMITS.drivers) return;
    drivers.set(iracingId, {
      iracingId,
      name: text(raw?.name) ?? `Driver ${drivers.size + 1}`,
      availability: [],
    });
  };
  list(planning.roster, RACE_PLAN_LIMITS.drivers).forEach(add);
  for (const entry of list(
    planning.driver_availabilities,
    RACE_PLAN_LIMITS.drivers
  )) {
    const raw = asObject(entry);
    add(raw?.driver);
    const driver = drivers.get(
      positiveInt(asObject(raw?.driver)?.iracing_id) ?? 0
    );
    if (!driver) continue;
    driver.availability = list(raw?.periods, RACE_PLAN_LIMITS.periods)
      .map(normalizePeriod)
      .filter((period): period is RacePlanAvailability => period !== null)
      .sort((a, b) => a.startMs - b.startMs);
  }
  return [...drivers.values()];
};

const normalizeFigures = (value: unknown): RacePlanDriverFigures | null => {
  const raw = asObject(value);
  const iracingId = positiveInt(raw?.iracing_id);
  if (!raw || !iracingId) return null;
  return {
    iracingId,
    avgLapMsDry: positiveNumber(raw.average_lap_time_dry, LAP_MS_MAX),
    avgLapMsWet: positiveNumber(raw.average_lap_time_wet, LAP_MS_MAX),
    fuelPerLapDry: positiveNumber(
      raw.average_fuel_consumption_dry,
      FUEL_PER_LAP_MAX
    ),
    fuelPerLapWet: positiveNumber(
      raw.average_fuel_consumption_wet,
      FUEL_PER_LAP_MAX
    ),
  };
};

const normalizeStint = (
  value: unknown,
  raceStartMs: number
): RacePlanStint | null => {
  const raw = asObject(value);
  if (!raw) return null;
  const number = positiveInt(raw.number);
  const startMs = isoTime(raw.start_at);
  const endMs = isoTime(raw.end_at);
  const laps =
    nonNegativeInt(raw.pinned_laps) ?? nonNegativeInt(raw.estimated_laps);
  if (
    number === null ||
    startMs === null ||
    endMs === null ||
    endMs < startMs ||
    laps === null
  )
    return null;
  return {
    number,
    driverId: positiveInt(asObject(raw.driver)?.iracing_id),
    startSec: (startMs - raceStartMs) / 1000,
    endSec: (endMs - raceStartMs) / 1000,
    laps,
    setup: raw.setup === 'wet' ? 'wet' : 'dry',
    fuel: positiveNumber(raw.fuel_consumption, STINT_FUEL_MAX),
    locked: raw.locked === true,
  };
};

const normalizeStrategy = (value: unknown): RacePlanStrategy | null => {
  const raw = asObject(value);
  if (!raw) return null;
  const id = positiveInt(raw.id);
  const raceStartMs = isoTime(raw.race_start_at);
  if (id === null || raceStartMs === null || !Array.isArray(raw.stints))
    return null;
  const stints: RacePlanStint[] = [];
  for (const entry of list(raw.stints, RACE_PLAN_LIMITS.stints)) {
    const stint = normalizeStint(entry, raceStartMs);
    // A stint we cannot read would shift every stint after it: reject.
    if (!stint) return null;
    stints.push(stint);
  }
  stints.sort((a, b) => a.number - b.number);
  return {
    id,
    name: text(raw.name) ?? `Strategy ${id}`,
    raceStartMs,
    fuelCapacity: positiveNumber(raw.fuel_capacity, STINT_FUEL_MAX),
    pitStopMs: positiveNumber(raw.pit_stop_time, PIT_STOP_MS_MAX),
    updatedAt:
      typeof raw.updated_at === 'string' && isoTime(raw.updated_at) !== null
        ? raw.updated_at
        : new Date(raceStartMs).toISOString(),
    drivers: list(raw.drivers, RACE_PLAN_LIMITS.drivers)
      .map(normalizeFigures)
      .filter((d): d is RacePlanDriverFigures => d !== null),
    stints,
  };
};

/**
 * Checks an untrusted planning response (or the `planning` object inside
 * it) and converts it to a `RacePlanning`. Returns null when the shape is
 * not usable.
 */
export function normalizeRacePlanning(value: unknown): RacePlanning | null {
  const outer = asObject(value);
  const planning = asObject(outer?.planning) ?? outer;
  if (!planning) return null;
  const id = positiveInt(planning.id);
  const session = asObject(planning.session);
  if (id === null || !session || !Array.isArray(planning.strategies))
    return null;
  const strategies: RacePlanStrategy[] = [];
  for (const entry of list(planning.strategies, RACE_PLAN_LIMITS.strategies)) {
    const strategy = normalizeStrategy(entry);
    if (strategy) strategies.push(strategy);
  }
  if (strategies.length === 0) return null;
  const track = asObject(planning.track);
  const registrable = asObject(planning.registrable);
  return {
    source: 'iraceplan',
    id,
    sessionName: text(session.name) ?? `Planning ${id}`,
    car: text(planning.car),
    teamId:
      planning.type === 'team' ? positiveInt(registrable?.iracing_id) : null,
    trackId: positiveInt(track?.iracing_id),
    trackName: text(track?.name),
    updatedAt:
      typeof planning.updated_at === 'string' &&
      isoTime(planning.updated_at) !== null
        ? planning.updated_at
        : strategies[0].updatedAt,
    drivers: normalizeDrivers(planning),
    strategies,
  };
}

/** Raw `planning` object from a response, kept for the on-disk cache. */
export const rawPlanningOf = (value: unknown): Raw | null => {
  const outer = asObject(value);
  return asObject(outer?.planning) ?? outer;
};

/** Checks an untrusted list response: `{ plannings: [...], meta }`. */
export function normalizeRacePlanList(
  value: unknown
): RacePlanListing[] | null {
  const entries = asObject(value)?.plannings;
  if (!Array.isArray(entries)) return null;
  const listings: RacePlanListing[] = [];
  for (const entry of entries.slice(0, RACE_PLAN_LIMITS.listings)) {
    const raw = asObject(entry);
    const id = positiveInt(raw?.id);
    if (!raw || id === null) continue;
    const session = asObject(raw.session);
    const startAt = session?.start_at;
    listings.push({
      id,
      name: text(session?.name) ?? `Planning ${id}`,
      car: text(raw.car),
      isTeam: raw.type === 'team',
      trackName: text(asObject(raw.track)?.name),
      startAt:
        typeof startAt === 'string' && isoTime(startAt) !== null
          ? startAt
          : null,
    });
  }
  return listings;
}
