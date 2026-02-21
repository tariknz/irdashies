import type { DriverTagSettings } from '@irdashies/types';
import { readData, writeData } from './storage';

const DRIVER_TAG_SETTINGS_KEY = 'driverTagSettings';

export const getDriverTagSettings = (): DriverTagSettings | undefined => {
  return readData<DriverTagSettings>(DRIVER_TAG_SETTINGS_KEY);
};

export const saveDriverTagSettings = (settings: DriverTagSettings): void => {
  writeData(DRIVER_TAG_SETTINGS_KEY, settings);
};
