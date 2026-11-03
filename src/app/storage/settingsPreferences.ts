import {
  isSimulatorPreference,
  type SimulatorPreference,
} from '@irdashies/types';
import { getCurrentProfileId, getDashboard } from './dashboards';
import { readData, writeData } from './storage';

const SIMULATOR_PREFERENCE_KEY = 'simulatorPreference';

/**
 * Which simulator to read. Stored beside the other settings-window preferences
 * so switching profile cannot replace it. The first read copies the active
 * profile's saved value once, which is where the choice used to live.
 */
export const getSimulatorPreference = (): SimulatorPreference => {
  const stored = readData<unknown>(SIMULATOR_PREFERENCE_KEY);
  if (isSimulatorPreference(stored)) return stored;

  const fromProfile = getDashboard(getCurrentProfileId())?.generalSettings
    ?.simulator;
  const preference = isSimulatorPreference(fromProfile) ? fromProfile : 'auto';
  writeData(SIMULATOR_PREFERENCE_KEY, preference);
  return preference;
};

export const setSimulatorPreference = (
  preference: SimulatorPreference
): void => {
  writeData(SIMULATOR_PREFERENCE_KEY, preference);
};
