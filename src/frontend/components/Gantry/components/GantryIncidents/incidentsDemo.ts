import { IncidentType, type Incident } from '@irdashies/types';

const BASE: Omit<Incident, 'id' | 'timestamp' | 'sessionTime' | 'type'>[] = [
  {
    carIdx: 0,
    driverName: 'R. Grosjean',
    carNumber: '77',
    teamName: 'Alpine Racing',
    sessionNum: 2,
    lapNum: 12,
    replayFrameNum: 109410,
    lapDistPct: 0.482,
  },
  {
    carIdx: 1,
    driverName: 'O. Jarvis',
    carNumber: '60',
    teamName: 'JOTA',
    sessionNum: 2,
    lapNum: 12,
    replayFrameNum: 108072,
    lapDistPct: 0.97,
  },
  {
    carIdx: 2,
    driverName: 'F. Albuquerque',
    carNumber: '22',
    teamName: 'United Autosports',
    sessionNum: 2,
    lapNum: 11,
    replayFrameNum: 105000,
    lapDistPct: 0.312,
  },
  {
    carIdx: 3,
    driverName: 'N. Mueller',
    carNumber: '31',
    teamName: 'WRT',
    sessionNum: 2,
    lapNum: 11,
    replayFrameNum: 102144,
    lapDistPct: 0.655,
  },
];

const TYPES = [
  IncidentType.Crash,
  IncidentType.PitEntry,
  IncidentType.OffTrack,
  IncidentType.Slowdown,
  IncidentType.BlackFlag,
] as const;

/** Grows the incident feed and refreshes timestamps while demo mode runs. */
export const getDemoIncidents = (elapsedSec = 0): Incident[] => {
  const count = Math.min(BASE.length, 1 + Math.floor(elapsedSec / 5));
  const now = Date.now();
  return BASE.slice(0, count).map((base, index) => ({
    ...base,
    id: `demo-${index}-${Math.floor(elapsedSec / 5)}`,
    type: TYPES[index % TYPES.length],
    sessionTime: 1800 - index * 40 + elapsedSec,
    timestamp: now - index * 15_000,
    lapNum: 10 + Math.floor(elapsedSec / 20) - index,
  }));
};
