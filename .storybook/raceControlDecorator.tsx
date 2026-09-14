import type { Decorator } from '@storybook/react-vite';
import { useEffect, useMemo } from 'react';
import { useRaceControlStore } from '../src/frontend/context/RaceControlStore/RaceControlStore';
import { IncidentType } from '../src/types/raceControl';
import type { Incident } from '../src/types/raceControl';

export const mockIncidents: Incident[] = [
  {
    id: '0-1823.5',
    carIdx: 0,
    driverName: 'R. Grosjean',
    carNumber: '77',
    teamName: 'Alpine Racing',
    sessionNum: 0,
    sessionTime: 1823.5,
    lapNum: 12,
    replayFrameNum: 109410,
    type: IncidentType.Crash,
    lapDistPct: 0.482,
    timestamp: Date.now() - 60000,
    debug: {
      trigger: 'sustained-slow',
      evidence: 'avgSpeed 8.2 km/h < threshold 15 km/h for 1.20s',
      thresholds: {
        slowSpeedThreshold: 15,
        slowDurationSeconds: 1,
        impactDecelKmhPerSec: 150,
        impactMinSpeed: 20,
        offTrackDurationSeconds: 0.3,
        pitEntryDurationSeconds: 0.6,
        cooldownSeconds: 5,
      },
      carStateAtDetection: {
        currentAvgSpeed: 8.58,
        recentPositions: [
          { sessionTime: 1230.1, lapDistPct: 0.48198 },
          { sessionTime: 1230.6, lapDistPct: 0.48204 },
          { sessionTime: 1231.1, lapDistPct: 0.4821 },
        ],
        slowForSeconds: 1.2,
        offTrackForSeconds: 0,
        prevTrackSurface: 3,
        prevSessionFlags: 0,
        prevOnPitRoad: false,
        prevLapDistPct: 0.4821,
      },
      frameHistory: [
        {
          speed: 45.2,
          lapDistPct: 0.478,
          trackSurface: 3,
          sessionTime: 1823.4,
        },
        {
          speed: 8.2,
          lapDistPct: 0.482,
          trackSurface: 3,
          sessionTime: 1823.5,
        },
      ],
    },
  },
  {
    id: '1-1801.2',
    carIdx: 1,
    driverName: 'O. Jarvis',
    carNumber: '60',
    teamName: 'JOTA',
    sessionNum: 0,
    sessionTime: 1801.2,
    lapNum: 12,
    replayFrameNum: 108072,
    type: IncidentType.PitEntry,
    lapDistPct: 0.97,
    timestamp: Date.now() - 82000,
  },
  {
    id: '2-1750.0',
    carIdx: 2,
    driverName: 'F. Albuquerque',
    carNumber: '22',
    teamName: 'United Autosports',
    sessionNum: 0,
    sessionTime: 1750.0,
    lapNum: 11,
    replayFrameNum: 105000,
    type: IncidentType.OffTrack,
    lapDistPct: 0.312,
    timestamp: Date.now() - 133000,
  },
  {
    id: '3-1702.4',
    carIdx: 3,
    driverName: 'N. Mueller',
    carNumber: '31',
    teamName: 'WRT',
    sessionNum: 0,
    sessionTime: 1702.4,
    lapNum: 11,
    replayFrameNum: 102144,
    type: IncidentType.Slowdown,
    lapDistPct: 0.655,
    timestamp: Date.now() - 181000,
  },
  {
    id: '5-1688.9',
    carIdx: 5,
    driverName: 'A. Rossi',
    carNumber: '9',
    teamName: 'Meyer Shank Racing',
    sessionNum: 0,
    sessionTime: 1688.9,
    lapNum: 11,
    replayFrameNum: 101334,
    type: IncidentType.BlackFlag,
    lapDistPct: 0.204,
    timestamp: Date.now() - 195000,
  },
];

const RaceControlLoader = ({ incidents }: { incidents: Incident[] }) => {
  const hydrateIncidents = useRaceControlStore((s) => s.hydrateIncidents);
  const clearIncidents = useRaceControlStore((s) => s.clearIncidents);
  useEffect(() => {
    // The store is module scoped, so it survives a story switch. Clear first or
    // hydration merges the previous story feed into this one, and hydration
    // deduplicates by id so an edited incident would keep the stale object.
    clearIncidents();
    hydrateIncidents(incidents);
  }, [clearIncidents, hydrateIncidents, incidents]);
  return null;
};

/**
 * Seeds the incident feed. Pass a list, or a function of the story's args so a
 * control can swap the feed. The default is the mixed set of five types.
 */
export const RaceControlDecorator: (
  incidents?: Incident[] | ((args: Record<string, unknown>) => Incident[])
) => Decorator = (incidents = mockIncidents) => {
  const Component = (
    Story: Parameters<Decorator>[0],
    context: Parameters<Decorator>[1]
  ) => {
    // A feed built from args returns a fresh array every render, which would
    // clear and rehydrate in a loop. Hold one array per set of args instead:
    // the identity is then stable, and any edit to a feed still lands because
    // changing a control changes the key.
    const argsKey = JSON.stringify(context.args ?? {});
    const resolved = useMemo(
      () =>
        typeof incidents === 'function'
          ? incidents(context.args as Record<string, unknown>)
          : incidents,
      [argsKey]
    );
    return (
      <>
        <RaceControlLoader incidents={resolved} />
        <Story />
      </>
    );
  };
  Component.displayName = 'RaceControlDecorator';
  return Component;
};
