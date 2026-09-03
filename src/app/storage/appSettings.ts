import type { SessionProfileMap } from '@irdashies/types';
import { SESSION_PROFILE_KEYS } from '@irdashies/types';
import { readData, writeData } from './storage';

const CYCLE_PROFILES_KEY = 'cycleProfiles';
const SHOW_PROFILE_BANNER_KEY = 'showProfileBanner';
const SESSION_PROFILE_MAP_KEY = 'sessionProfileMap';

export const getCycleProfiles = (): boolean => {
  return readData<boolean>(CYCLE_PROFILES_KEY) ?? false;
};

export const setCycleProfiles = (enabled: boolean): void => {
  writeData(CYCLE_PROFILES_KEY, enabled);
};

export const getShowProfileBanner = (): boolean => {
  return readData<boolean>(SHOW_PROFILE_BANNER_KEY) ?? true;
};

export const setShowProfileBanner = (enabled: boolean): void => {
  writeData(SHOW_PROFILE_BANNER_KEY, enabled);
};

/**
 * Which profile to switch to for each session type, plus one for spotting.
 * A key with no profile means "leave the profile alone" for that trigger.
 */
export const getSessionProfileMap = (): SessionProfileMap => {
  return readData<SessionProfileMap>(SESSION_PROFILE_MAP_KEY) ?? {};
};

export const setSessionProfileMap = (map: SessionProfileMap): void => {
  writeData(SESSION_PROFILE_MAP_KEY, map);
};

/**
 * First run only: point every session type at the profile already in use.
 *
 * Starting with nothing mapped left the settings page looking inert and made
 * the feature easy to miss. Seeding it with the current profile shows what the
 * mapping is for, and is behaviourally a no-op — every session type resolves to
 * the profile that is already active, so nothing switches until the user
 * changes a row.
 *
 * Spotting is deliberately left unset. It is a state rather than a session
 * type, and pre-arming it would mean the overlay changes the first time the
 * player steps out of the car, which nobody asked for.
 *
 * "Never configured" is distinguished from "deliberately cleared": only an
 * absent key seeds. A user who empties every row keeps an empty map.
 */
export const initialiseSessionProfileMap = (
  currentProfileId: string
): SessionProfileMap => {
  const stored = readData<SessionProfileMap>(SESSION_PROFILE_MAP_KEY);
  if (stored !== undefined) return stored;

  const seeded: SessionProfileMap = {};
  for (const key of SESSION_PROFILE_KEYS) {
    seeded[key] = currentProfileId;
  }
  writeData(SESSION_PROFILE_MAP_KEY, seeded);
  return seeded;
};
