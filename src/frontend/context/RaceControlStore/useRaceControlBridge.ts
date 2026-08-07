import { useEffect } from 'react';
import { useRaceControlStore } from './RaceControlStore';

export const useRaceControlBridge = () => {
  const setIncidents = useRaceControlStore((s) => s.setIncidents);
  const addIncident = useRaceControlStore((s) => s.addIncident);

  useEffect(() => {
    if (!window.raceControlBridge) return;
    window.raceControlBridge.getIncidents().then(setIncidents);
  }, [setIncidents]);

  useEffect(() => {
    if (!window.channelBridge) return;
    return window.channelBridge.subscribe('raceControl.incidents', addIncident);
  }, [addIncident]);
};
