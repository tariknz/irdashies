import { useCallback } from 'react';
import logger from '@irdashies/utils/logger';

/**
 * Points the sim's camera at a car by its number. Only meaningful in a replay
 * or when spectating; iRacing ignores it while you are driving.
 */
export const useFocusDriver = () =>
  useCallback((carNumber: string) => {
    window.raceControlBridge
      ?.focusDriver(carNumber)
      .catch((err) => logger.warn('[Gantry] focusDriver failed:', err));
  }, []);
