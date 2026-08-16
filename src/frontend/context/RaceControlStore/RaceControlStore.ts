import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { IncidentType } from '../../../types/raceControl';
import type { Incident } from '../../../types/raceControl';

// Endurance sessions can generate thousands of incidents; cap the list so
// memory doesn't grow unbounded over a long race.
const MAX_INCIDENTS = 2_000;

interface RaceControlState {
  incidents: Incident[];
  activeTypeFilters: Set<IncidentType>;
  driverFilter: number | null; // carIdx, null = all
  /**
   * Bumped whenever the live list is discarded (clear, session change). A
   * hydration that was requested before the bump is stale by the time it
   * resolves, so it is dropped rather than resurrecting cleared incidents.
   */
  hydrationEpoch: number;

  addIncident: (incident: Incident) => void;
  clearIncidents: () => void;
  resetForSession: () => void;
  toggleTypeFilter: (type: IncidentType) => void;
  setDriverFilter: (carIdx: number | null) => void;
  hydrateIncidents: (incidents: Incident[], epoch?: number) => void;
}

/** Newest first, matching the order `addIncident` maintains. */
const byNewestFirst = (a: Incident, b: Incident) =>
  b.timestamp - a.timestamp || b.sessionTime - a.sessionTime;

export const useRaceControlStore = create<RaceControlState>((set, get) => ({
  incidents: [],
  activeTypeFilters: new Set(Object.values(IncidentType)), // all on by default
  driverFilter: null,
  hydrationEpoch: 0,

  addIncident: (incident) =>
    set((s) => {
      if (s.incidents.some((i) => i.id === incident.id)) return s;
      return {
        incidents: [incident, ...s.incidents].slice(0, MAX_INCIDENTS),
      };
    }),

  clearIncidents: () =>
    set((s) => ({ incidents: [], hydrationEpoch: s.hydrationEpoch + 1 })),

  resetForSession: () =>
    set((s) => ({
      incidents: [],
      driverFilter: null,
      hydrationEpoch: s.hydrationEpoch + 1,
    })),

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

  hydrateIncidents: (incidents, epoch) => {
    // The persisted snapshot is fetched asynchronously, so live incidents can
    // land first. Merge rather than replace, and drop the response outright if
    // the list was cleared while the request was in flight.
    if (epoch !== undefined && epoch !== get().hydrationEpoch) return;
    set((s) => {
      const seen = new Set<string>();
      const merged = [...s.incidents, ...incidents]
        .filter((i) => !seen.has(i.id) && seen.add(i.id))
        .sort(byNewestFirst)
        .slice(0, MAX_INCIDENTS);
      return { incidents: merged };
    });
  },
}));

/**
 * Snapshot the epoch before starting an async hydration, then pass it back to
 * `hydrateIncidents` so a clear that lands in between wins.
 */
export const currentHydrationEpoch = () =>
  useRaceControlStore.getState().hydrationEpoch;

export const useFilteredIncidents = () =>
  useStoreWithEqualityFn(
    useRaceControlStore,
    (s) =>
      s.incidents.filter(
        (i) =>
          s.activeTypeFilters.has(i.type) &&
          (s.driverFilter === null || i.carIdx === s.driverFilter)
      ),
    shallow
  );
