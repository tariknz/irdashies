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
 * An empty map means the feature is off, which is how it starts.
 */
export const getSessionProfileMap = (): SessionProfileMap => {
  return readData<SessionProfileMap>(SESSION_PROFILE_MAP_KEY) ?? {};
};

export const setSessionProfileMap = (map: SessionProfileMap): void => {
  writeData(SESSION_PROFILE_MAP_KEY, map);
};
