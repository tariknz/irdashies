import logger from '../logger';
import { readData, writeData } from './storage';

const RACEOS_OPT_IN_KEY = 'raceosOptIn';
let raceosOptIn: boolean | undefined;
const optInListeners = new Set<(optIn: boolean) => void>();

export const getRaceosOptIn = (): boolean => {
  raceosOptIn ??= readData<boolean>(RACEOS_OPT_IN_KEY) ?? false;
  return raceosOptIn;
};

export const onRaceosOptInChanged = (
  listener: (optIn: boolean) => void
): (() => void) => {
  optInListeners.add(listener);
  return () => optInListeners.delete(listener);
};

export const setRaceosOptIn = (optIn: boolean): void => {
  const changed = optIn !== raceosOptIn;
  raceosOptIn = optIn;
  try {
    writeData(RACEOS_OPT_IN_KEY, optIn);
  } finally {
    if (changed) {
      optInListeners.forEach((listener) => {
        try {
          listener(optIn);
        } catch (err) {
          logger.error('Error in RaceOS opt-in listener:', err);
        }
      });
    }
  }
};
