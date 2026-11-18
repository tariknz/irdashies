import type {
  DashboardLayout,
  GantryPitStopsConfig,
  PitServiceProfile,
} from '@irdashies/types';
import {
  GANTRY_PIT_PROFILES_MAX,
  sanitizeGantryPitStops,
  sanitizePitServiceProfile,
} from '@irdashies/types';

const GANTRY_ID = 'gantry';
const EXPORT_KIND = 'irdashies-pit-timings';

export const readGantryPitStops = (
  dashboard: DashboardLayout | undefined
): GantryPitStopsConfig =>
  sanitizeGantryPitStops(
    dashboard?.widgets.find((widget) => widget.id === GANTRY_ID)?.config
      ?.pitStops
  );

/** Replaces the Gantry's pit timings. Other widgets are left alone. */
export const withGantryPitStops = (
  dashboard: DashboardLayout,
  pitStops: GantryPitStopsConfig
): DashboardLayout => ({
  ...dashboard,
  widgets: dashboard.widgets.map((widget) =>
    widget.id === GANTRY_ID
      ? {
          ...widget,
          config: {
            ...widget.config,
            pitStops: sanitizeGantryPitStops(pitStops),
          },
        }
      : widget
  ),
});

/** A blank profile for a car, with nothing offered until it is filled in. */
export const newPitProfile = (
  carPath: string,
  name: string
): PitServiceProfile => ({
  id: carPath,
  carPath,
  name,
  fuelRate: 1,
  tyres: { front: 0, rear: 0, left: 0, right: 0, all: 0 },
  driverChangeSeconds: 0,
  fuelPerLap: 0,
  tankLitres: 0,
});

/** The file other team members import. */
export const exportPitProfiles = (
  profiles: readonly PitServiceProfile[]
): string =>
  JSON.stringify({ kind: EXPORT_KIND, version: 1, profiles }, null, 2);

/**
 * Reads an exported file. An imported car replaces the profile for the same
 * car; the rest are kept. New cars are added only while there is room, and
 * the ones left out are counted in `skipped`. Returns null for a file that is
 * not pit timings.
 */
export const importPitProfiles = (
  current: readonly PitServiceProfile[],
  text: string
): {
  profiles: PitServiceProfile[];
  imported: number;
  skipped: number;
} | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { kind?: unknown }).kind !== EXPORT_KIND ||
    !Array.isArray((parsed as { profiles?: unknown }).profiles)
  )
    return null;
  const incoming = new Map<string, PitServiceProfile>();
  for (const raw of (parsed as { profiles: unknown[] }).profiles) {
    const profile = sanitizePitServiceProfile(raw);
    if (profile && !incoming.has(profile.carPath))
      incoming.set(profile.carPath, profile);
  }
  const existing = new Set(current.map((profile) => profile.carPath));
  let room = GANTRY_PIT_PROFILES_MAX - current.length;
  const accepted = [...incoming.values()].filter((profile) => {
    if (existing.has(profile.carPath)) return true;
    if (room <= 0) return false;
    room -= 1;
    return true;
  });
  const replaced = new Set(accepted.map((profile) => profile.carPath));
  return {
    profiles: [
      ...current.filter((profile) => !replaced.has(profile.carPath)),
      ...accepted,
    ],
    imported: accepted.length,
    skipped: incoming.size - accepted.length,
  };
};
