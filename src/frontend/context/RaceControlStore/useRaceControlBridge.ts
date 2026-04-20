import { useEffect } from 'react';
import { useRaceControlStore } from './RaceControlStore';

export const useRaceControlBridge = () => {
  const setIncidents = useRaceControlStore((s) => s.setIncidents);
  const addIncident = useRaceControlStore((s) => s.addIncident);

  useEffect(() => {
    if (!window.raceControlBridge) return;

    window.raceControlBridge.getIncidents().then(setIncidents);

    const cleanup = window.raceControlBridge.onIncident(addIncident);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
