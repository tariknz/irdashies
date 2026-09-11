import type { SessionProfileMap } from '@irdashies/types';
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
 * A key with no profile means "leave the profile alone" for that trigger, and
 * an unconfigured install has no key set at all.
 *
 * Nothing is seeded here. An earlier version pointed every session type at the
 * profile in use on first run so the settings page would show what the mapping
 * was for, described as behaviourally a no-op — and it is, but only while the
 * seeded profile stays active. Seed profile A, manually switch to B without
 * ever opening this feature, and the next session transition drags you back to
 * A: an automatic profile switch for someone who never asked for one, against
 * this feature's own documented default. Discoverability is a settings-page
 * problem and is solved there, with rows reading "Don't switch" and a one-click
 * "Use current profile for all".
 */
export const getSessionProfileMap = (): SessionProfileMap => {
  return readData<SessionProfileMap>(SESSION_PROFILE_MAP_KEY) ?? {};
};

export const setSessionProfileMap = (map: SessionProfileMap): void => {
  writeData(SESSION_PROFILE_MAP_KEY, map);
};
