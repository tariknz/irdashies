import { GlobalFlags, IncidentType, type Incident } from '@irdashies/types';
import type { Standings } from '@irdashies/domain';
import { formatTime } from '@irdashies/utils/time';

export type EventKind =
  | 'crash'
  | 'offTrack'
  | 'slowdown'
  | 'blackFlag'
  | 'yellow'
  | 'caution'
  | 'fastestLap'
  | 'pitStop'
  | 'meatball'
  | 'disqualified'
  | 'finalLap'
  | 'checkered';

export interface BroadcastEvent {
  id: string;
  kind: EventKind;
  carIdx?: number;
  carNumber?: string;
  driverName?: string;
  lap?: number;
  /** Extra line under the driver, e.g. a lap or pit lane time. */
  detail?: string;
}

const INCIDENT_KINDS: Partial<Record<IncidentType, EventKind>> = {
  [IncidentType.Crash]: 'crash',
  [IncidentType.OffTrack]: 'offTrack',
  [IncidentType.Slowdown]: 'slowdown',
  [IncidentType.BlackFlag]: 'blackFlag',
};

/** Pit entry misses are left to the Gantry; viewers don't need them. */
export const eventFromIncident = (
  incident: Incident
): BroadcastEvent | undefined => {
  const kind = INCIDENT_KINDS[incident.type];
  if (!kind) return undefined;
  return {
    id: incident.id,
    kind,
    carIdx: incident.carIdx,
    carNumber: incident.carNumber,
    driverName: incident.driverName,
    lap: incident.lapNum,
  };
};

const CAUTION = GlobalFlags.Caution | GlobalFlags.CautionWaving;
const YELLOW = GlobalFlags.Yellow | GlobalFlags.YellowWaving;

/** A flag that has just come out, comparing two SessionFlags readings. */
export const flagKind = (prev: number, next: number): EventKind | undefined => {
  const out = (bits: number) => !!(next & bits) && !(prev & bits);
  if (out(GlobalFlags.Checkered)) return 'checkered';
  if (out(GlobalFlags.White)) return 'finalLap';
  if (out(CAUTION)) return 'caution';
  if (next & YELLOW && !(prev & (YELLOW | CAUTION))) return 'yellow';
  return undefined;
};

/** What the car tracker remembers between standings updates. */
export interface CarTracker {
  cars: Map<
    number,
    { onPitRoad: boolean; repair: boolean; dnf: boolean; pitSince?: number }
  >;
  /** Best lap so far in each class, in seconds. */
  classBest: Map<number, number>;
}

export const emptyCarTracker = (): CarTracker => ({
  cars: new Map(),
  classBest: new Map(),
});

/**
 * Events from comparing two standings updates: a new class fastest lap, a
 * finished pit stop (with its pit lane time), a meatball or a disqualification.
 * The first update only sets the baseline, so opening the overlay mid-race
 * does not replay the whole field.
 */
export const carEvents = (
  tracker: CarTracker,
  standings: readonly Standings[],
  now: number
): { tracker: CarTracker; events: BroadcastEvent[] } => {
  const primed = tracker.cars.size > 0;
  const next = emptyCarTracker();
  next.classBest = new Map(tracker.classBest);
  const events: BroadcastEvent[] = [];
  const event = (s: Standings, kind: EventKind, detail?: string) =>
    events.push({
      id: `${kind}-${s.carIdx}-${now}`,
      kind,
      carIdx: s.carIdx,
      lap: s.lap,
      detail,
    });

  for (const s of standings) {
    const was = tracker.cars.get(s.carIdx);
    let pitSince = s.onPitRoad ? was?.pitSince : undefined;
    if (was) {
      if (s.onPitRoad && !was.onPitRoad) pitSince = now;
      if (!s.onPitRoad && was.onPitRoad && was.pitSince !== undefined) {
        const seconds = (now - was.pitSince) / 1000;
        event(s, 'pitStop', `Pit lane ${seconds.toFixed(1)}s`);
      }
      if (s.repair && !was.repair) event(s, 'meatball');
      if (s.dnf && !was.dnf) event(s, 'disqualified');
    }
    next.cars.set(s.carIdx, {
      onPitRoad: s.onPitRoad,
      repair: s.repair,
      dnf: s.dnf,
      pitSince,
    });

    const best = next.classBest.get(s.carClass.id);
    if (s.fastestTime > 0 && (best === undefined || s.fastestTime < best)) {
      next.classBest.set(s.carClass.id, s.fastestTime);
      // The first lap of a class is everyone's fastest; that is not news.
      if (primed && best !== undefined) {
        event(s, 'fastestLap', formatTime(s.fastestTime, 'full'));
      }
    }
  }
  return { tracker: next, events };
};

const DEMO_KINDS: readonly EventKind[] = [
  'crash',
  'yellow',
  'fastestLap',
  'slowdown',
  'pitStop',
  'blackFlag',
  'meatball',
  'caution',
  'disqualified',
  'offTrack',
  'finalLap',
  'checkered',
];

const DEMO_DETAIL: Partial<Record<EventKind, string>> = {
  fastestLap: '1:47.382',
  pitStop: 'Pit lane 38.4s',
};

/** Flags that belong to the whole field rather than one car. */
const FIELD_KINDS: ReadonlySet<EventKind> = new Set(['caution', 'finalLap']);

/**
 * The n-th made-up event for demo mode, cycling through the enabled kinds and
 * the cars in the session. A full course yellow has no car of its own.
 */
export const demoEvent = (
  n: number,
  carIdxs: readonly number[],
  enabled?: Partial<Record<EventKind, boolean>>
): BroadcastEvent | undefined => {
  const kinds = DEMO_KINDS.filter((k) => enabled?.[k] !== false);
  if (!kinds.length) return undefined;
  const kind = kinds[n % kinds.length];
  const carIdx =
    FIELD_KINDS.has(kind) || !carIdxs.length
      ? undefined
      : carIdxs[n % carIdxs.length];
  return {
    id: `demo-${n}`,
    kind,
    carIdx,
    lap: n + 1,
    detail: DEMO_DETAIL[kind],
  };
};
