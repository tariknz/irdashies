/**
 * Pit service timings per car, used to estimate what each competitor's stop
 * included from how long the car sat in its stall.
 */

/** Seconds for each kind of tyre change; 0 means the car does not offer it. */
export interface PitTyreTimes {
  front: number;
  rear: number;
  /** One side, for series that change left or right instead of an axle. */
  left: number;
  right: number;
  all: number;
}

export type PitTyreChange = keyof PitTyreTimes;

export interface PitServiceProfile {
  id: string;
  /** The iRacing car path the profile applies to, such as `renaultcliocup`. */
  carPath: string;
  name: string;
  /** Litres added per second of fuelling. Fuel and tyres are serviced one after the other. */
  fuelRate: number;
  tyres: PitTyreTimes;
  /** A driver swap. It runs alongside the service, so only a short stop waits for it. */
  driverChangeSeconds: number;
  /** Typical fuel use per lap; tells a long fuel stop from fuel and tyres. 0 if unknown. */
  fuelPerLap: number;
  /** 0 if unknown. */
  tankLitres: number;
}

export interface GantryPitStopsConfig {
  profiles: PitServiceProfile[];
}

export const PIT_PROFILE_LIMITS = {
  fuelRate: { min: 0.1, max: 20 },
  tyreSeconds: { min: 0, max: 120 },
  driverChangeSeconds: { min: 0, max: 180 },
  fuelPerLap: { min: 0, max: 50 },
  tankLitres: { min: 0, max: 500 },
} as const;

export const GANTRY_PIT_PROFILES_MAX = 50;

/** Renault Clio Cup: 37.2 L in 38 s, 22.24 s an axle, 40 s for four. */
export const CLIO_PIT_PROFILE: PitServiceProfile = {
  id: 'renaultcliocup',
  carPath: 'renaultcliocup',
  name: 'Renault Clio Cup',
  fuelRate: 0.98,
  tyres: { front: 22.24, rear: 22.24, left: 0, right: 0, all: 40 },
  driverChangeSeconds: 28,
  fuelPerLap: 0,
  tankLitres: 60,
};

export const DEFAULT_GANTRY_PIT_STOPS: GantryPitStopsConfig = {
  profiles: [CLIO_PIT_PROFILE],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const tyreSeconds = (value: unknown) =>
  clamp(
    value,
    PIT_PROFILE_LIMITS.tyreSeconds.min,
    PIT_PROFILE_LIMITS.tyreSeconds.max,
    0
  );

/** Reads one saved or imported profile, which is untrusted. */
export const sanitizePitServiceProfile = (
  value: unknown
): PitServiceProfile | null => {
  if (!isRecord(value)) return null;
  const carPath = typeof value.carPath === 'string' ? value.carPath.trim() : '';
  const id = typeof value.id === 'string' && value.id ? value.id : carPath;
  if (!carPath || !id) return null;
  const tyres = isRecord(value.tyres) ? value.tyres : {};
  const { fuelRate, driverChangeSeconds, fuelPerLap, tankLitres } =
    PIT_PROFILE_LIMITS;
  return {
    id,
    carPath,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : carPath,
    fuelRate: clamp(value.fuelRate, fuelRate.min, fuelRate.max, 1),
    tyres: {
      front: tyreSeconds(tyres.front),
      rear: tyreSeconds(tyres.rear),
      left: tyreSeconds(tyres.left),
      right: tyreSeconds(tyres.right),
      all: tyreSeconds(tyres.all),
    },
    driverChangeSeconds: clamp(
      value.driverChangeSeconds,
      driverChangeSeconds.min,
      driverChangeSeconds.max,
      0
    ),
    fuelPerLap: clamp(value.fuelPerLap, fuelPerLap.min, fuelPerLap.max, 0),
    tankLitres: clamp(value.tankLitres, tankLitres.min, tankLitres.max, 0),
  };
};

/** Reads the saved pit stop config; one profile per car, first one wins. */
export const sanitizeGantryPitStops = (
  value: unknown
): GantryPitStopsConfig => {
  if (!isRecord(value) || !Array.isArray(value.profiles))
    return DEFAULT_GANTRY_PIT_STOPS;
  const profiles: PitServiceProfile[] = [];
  const seen = new Set<string>();
  for (const raw of value.profiles) {
    if (profiles.length >= GANTRY_PIT_PROFILES_MAX) break;
    const profile = sanitizePitServiceProfile(raw);
    if (!profile || seen.has(profile.carPath)) continue;
    seen.add(profile.carPath);
    profiles.push(profile);
  }
  return { profiles };
};
