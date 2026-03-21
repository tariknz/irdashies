import type { Decorator } from '@storybook/react';
import { useEffect } from 'react';
import { useRaceControlStore } from '../src/frontend/context/RaceControlStore/RaceControlStore';
import { IncidentType } from '../src/types/raceControl';
import type { Incident } from '../src/types/raceControl';

const mockIncidents: Incident[] = [
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
      evidence:
        'avgSpeed 8.2 km/h < threshold 15 km/h for 12 consecutive frames (threshold: 10)',
      thresholds: {
        slowSpeedThreshold: 15,
        slowFrameThreshold: 10,
        suddenStopFromSpeed: 80,
        suddenStopToSpeed: 20,
        suddenStopFrames: 3,
        offTrackDebounce: 3,
        cooldownSeconds: 5,
      },
      carStateAtDetection: {
        speedHistory: [9.1, 8.8, 8.5, 8.3, 8.2],
        currentAvgSpeed: 8.58,
        recentRawSpeeds: [9.1, 8.8, 8.5],
        slowFrameCount: 12,
        offTrackFrameCount: 0,
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
];

const RaceControlLoader = () => {
  const setIncidents = useRaceControlStore((s) => s.setIncidents);
  useEffect(() => {
    setIncidents(mockIncidents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const RaceControlDecoratorComponent = (Story: Parameters<Decorator>[0]) => (
  <>
    <RaceControlLoader />
    <Story />
  </>
);
RaceControlDecoratorComponent.displayName = 'RaceControlDecoratorComponent';

export const RaceControlDecorator: () => Decorator = () =>
  RaceControlDecoratorComponent;
