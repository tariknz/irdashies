import { GlobalFlags, IncidentType, type Incident } from '@irdashies/types';

export type EventKind =
  'crash' | 'offTrack' | 'slowdown' | 'blackFlag' | 'yellow' | 'caution';

export interface BroadcastEvent {
  id: string;
  kind: EventKind;
  carIdx?: number;
  carNumber?: string;
  driverName?: string;
  lap?: number;
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
  if (next & CAUTION && !(prev & CAUTION)) return 'caution';
  if (next & YELLOW && !(prev & (YELLOW | CAUTION))) return 'yellow';
  return undefined;
};

const DEMO_KINDS: readonly EventKind[] = [
  'crash',
  'yellow',
  'slowdown',
  'blackFlag',
  'caution',
  'offTrack',
];

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
    kind === 'caution' || !carIdxs.length
      ? undefined
      : carIdxs[n % carIdxs.length];
  return { id: `demo-${n}`, kind, carIdx, lap: n + 1 };
};
