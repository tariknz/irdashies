import { readData, writeData } from './storage';

const CYCLE_PROFILES_KEY = 'cycleProfiles';
const SHOW_PROFILE_BANNER_KEY = 'showProfileBanner';

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
