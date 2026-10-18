import { readData, writeData } from './storage';
import { RadarPoleSideOverrides } from '../radarPoleSideOverrides';

const STORAGE_KEY = 'radarPoleSideOverrides';

/** The player's pole side corrections, kept in the app's config file. */
export const radarPoleSideOverrides = new RadarPoleSideOverrides({
  read: () => readData<unknown>(STORAGE_KEY),
  write: (overrides) => writeData(STORAGE_KEY, overrides),
});
