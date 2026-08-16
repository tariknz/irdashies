import { beforeEach, describe, expect, it } from 'vitest';
import { IncidentType } from '@irdashies/types';
import type { Incident } from '@irdashies/types';
import { currentHydrationEpoch, useRaceControlStore } from './RaceControlStore';

const MAX_INCIDENTS = 2_000;

const incident = (id: string, timestamp: number): Incident => ({
  id,
  carIdx: 1,
  driverName: 'Driver',
  carNumber: '1',
  teamName: 'Team',
  sessionNum: 0,
  sessionTime: timestamp,
  lapNum: 1,
  replayFrameNum: 0,
  type: IncidentType.OffTrack,
  lapDistPct: 0.5,
  timestamp,
});

const reset = () =>
  useRaceControlStore.setState({
    incidents: [],
    driverFilter: null,
    hydrationEpoch: 0,
  });

describe('RaceControlStore', () => {
  beforeEach(reset);

  describe('hydrateIncidents', () => {
    it('merges the persisted snapshot with incidents that arrived first', () => {
      const { addIncident, hydrateIncidents } = useRaceControlStore.getState();

      addIncident(incident('live', 300));
      hydrateIncidents([incident('old', 100), incident('older', 50)]);

      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['live', 'old', 'older']
      );
    });

    it('deduplicates ids present in both the live list and the snapshot', () => {
      const { addIncident, hydrateIncidents } = useRaceControlStore.getState();

      addIncident(incident('a', 200));
      hydrateIncidents([incident('a', 200), incident('b', 100)]);

      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['a', 'b']
      );
    });

    it('orders the merged list newest first', () => {
      useRaceControlStore
        .getState()
        .hydrateIncidents([
          incident('mid', 200),
          incident('newest', 300),
          incident('oldest', 100),
        ]);

      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['newest', 'mid', 'oldest']
      );
    });

    it('applies the retention cap to bulk hydration', () => {
      const persisted = Array.from({ length: MAX_INCIDENTS + 25 }, (_, i) =>
        incident(`i${i}`, i)
      );

      useRaceControlStore.getState().hydrateIncidents(persisted);

      const { incidents } = useRaceControlStore.getState();
      expect(incidents).toHaveLength(MAX_INCIDENTS);
      // Newest kept, oldest dropped.
      expect(incidents[0].id).toBe(`i${MAX_INCIDENTS + 24}`);
      expect(incidents.at(-1)?.id).toBe('i25');
    });

    it('drops a response whose epoch predates a clear', () => {
      const { addIncident, clearIncidents, hydrateIncidents } =
        useRaceControlStore.getState();

      addIncident(incident('live', 300));
      const epoch = currentHydrationEpoch();
      clearIncidents();
      hydrateIncidents([incident('stale', 100)], epoch);

      expect(useRaceControlStore.getState().incidents).toEqual([]);
    });

    it('accepts a response captured after the clear', () => {
      const { clearIncidents, hydrateIncidents } =
        useRaceControlStore.getState();

      clearIncidents();
      const epoch = currentHydrationEpoch();
      hydrateIncidents([incident('fresh', 100)], epoch);

      expect(useRaceControlStore.getState().incidents.map((i) => i.id)).toEqual(
        ['fresh']
      );
    });
  });

  describe('clearIncidents', () => {
    it('bumps the hydration epoch', () => {
      expect(currentHydrationEpoch()).toBe(0);
      useRaceControlStore.getState().clearIncidents();
      expect(currentHydrationEpoch()).toBe(1);
    });
  });

  describe('resetForSession', () => {
    it('clears incidents and the session-scoped driver filter', () => {
      useRaceControlStore.getState().addIncident(incident('old', 100));
      useRaceControlStore.getState().setDriverFilter(7);

      useRaceControlStore.getState().resetForSession();

      expect(useRaceControlStore.getState()).toMatchObject({
        incidents: [],
        driverFilter: null,
        hydrationEpoch: 1,
      });
    });
  });

  describe('addIncident', () => {
    it('caps the live list', () => {
      const { addIncident } = useRaceControlStore.getState();
      for (let i = 0; i < MAX_INCIDENTS + 10; i++) {
        addIncident(incident(`i${i}`, i));
      }
      expect(useRaceControlStore.getState().incidents).toHaveLength(
        MAX_INCIDENTS
      );
    });
  });
});
