import { create } from 'zustand';
import { IncidentType } from '../../../types/raceControl';
import type { Incident } from '../../../types/raceControl';

interface RaceControlState {
  incidents: Incident[];
  activeTypeFilters: Set<IncidentType>;
  driverFilter: number | null; // carIdx, null = all

  addIncident: (incident: Incident) => void;
  clearIncidents: () => void;
  toggleTypeFilter: (type: IncidentType) => void;
  setDriverFilter: (carIdx: number | null) => void;
  setIncidents: (incidents: Incident[]) => void;
}

export const useRaceControlStore = create<RaceControlState>((set) => ({
  incidents: [],
  activeTypeFilters: new Set(Object.values(IncidentType)), // all on by default
  driverFilter: null,

  addIncident: (incident) =>
    set((s) => ({ incidents: [incident, ...s.incidents] })),

  clearIncidents: () => set({ incidents: [] }),

  toggleTypeFilter: (type) =>
    set((s) => {
      const next = new Set(s.activeTypeFilters);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { activeTypeFilters: next };
    }),

  setDriverFilter: (carIdx) => set({ driverFilter: carIdx }),

  setIncidents: (incidents) => set({ incidents: [...incidents].reverse() }), // newest first
}));

export const useFilteredIncidents = () =>
  useRaceControlStore((s) => {
    return s.incidents.filter(
      (i) =>
        s.activeTypeFilters.has(i.type) &&
        (s.driverFilter === null || i.carIdx === s.driverFilter)
    );
  });
