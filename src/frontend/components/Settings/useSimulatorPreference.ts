import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '@irdashies/context';
import type { SimulatorPreference } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

/**
 * The app simulator preference. Seeded from main because it is not the
 * simulator field on the active profile — a profile switch must not move it.
 */
export const useSimulatorPreference = (): [
  SimulatorPreference,
  (next: SimulatorPreference) => void,
] => {
  const { bridge } = useDashboard();
  const [preference, setPreference] = useState<SimulatorPreference>('auto');
  const ignoreSnapshot = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let sawEvent = false;
    const unsubscribe = bridge.onSimulatorPreference?.((value) => {
      sawEvent = true;
      ignoreSnapshot.current = true;
      setPreference(value);
    });
    const request = bridge.getSimulatorPreference?.();
    if (request) {
      void request.then((value) => {
        if (!cancelled && value && !sawEvent && !ignoreSnapshot.current) {
          setPreference(value);
        }
      });
    }
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [bridge]);

  const change = (next: SimulatorPreference) => {
    ignoreSnapshot.current = true;
    setPreference(next);
    void Promise.resolve(bridge.setSimulatorPreference?.(next))
      .then(() => {
        bridge.notifySimulatorPreferenceChanged?.();
      })
      .catch((err) => {
        logger.error('Failed to set simulator preference', err);
      });
  };

  return [preference, change];
};
