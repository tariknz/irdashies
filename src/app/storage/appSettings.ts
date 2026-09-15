import { readData, writeData } from './storage';

const CYCLE_PROFILES_KEY = 'cycleProfiles';
const SHOW_PROFILE_BANNER_KEY = 'showProfileBanner';
const GARAGE61_LAST_FOLDER_KEY = 'garage61LastFolder';
const IBT_LAST_FOLDER_KEY = 'ibtLastFolder';

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

/** Directory the Garage 61 CSV picker last opened a file from, so it reopens there. */
export const getGarage61LastFolder = (): string | undefined => {
  return readData<string>(GARAGE61_LAST_FOLDER_KEY);
};

export const setGarage61LastFolder = (folderPath: string): void => {
  writeData(GARAGE61_LAST_FOLDER_KEY, folderPath);
};

/** Directory the .ibt picker last opened a file from, so it reopens there. */
export const getIbtLastFolder = (): string | undefined => {
  return readData<string>(IBT_LAST_FOLDER_KEY);
};

export const setIbtLastFolder = (folderPath: string): void => {
  writeData(IBT_LAST_FOLDER_KEY, folderPath);
};
