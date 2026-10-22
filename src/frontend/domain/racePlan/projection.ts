import type {
  RacePlanProgressSnapshot,
  RacePlanProjectedStint,
  RacePlanState,
  RacePlanStrategy,
  RacePlanning,
} from '@irdashies/types';

/** Race elapsed seconds to epoch milliseconds; null without a race start. */
export const elapsedToEpochMs = (
  raceStartMs: number | null | undefined,
  elapsedSec: number
): number | null =>
  raceStartMs === null || raceStartMs === undefined
    ? null
    : raceStartMs + elapsedSec * 1000;

const clockFormats = new Map<string, Intl.DateTimeFormat>();

const clockFormat = (timeZone: string | undefined) => {
  const key = timeZone ?? '';
  let format = clockFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    });
    clockFormats.set(key, format);
  }
  return format;
};

/** Wall-clock "HH:MM" in local time, or in `timeZone` when given. */
export const formatClock = (epochMs: number, timeZone?: string): string =>
  clockFormat(timeZone).format(epochMs);

/** Race elapsed time as "+H:MM", or "-H:MM" before the start. */
export const formatElapsed = (elapsedSec: number): string => {
  const sign = elapsedSec < 0 ? '-' : '+';
  const minutes = Math.floor(Math.abs(elapsedSec) / 60);
  const hours = Math.floor(minutes / 60);
  return `${sign}${hours}:${String(minutes % 60).padStart(2, '0')}`;
};

export interface RaceTimeOptions {
  /** Add the race elapsed time in brackets, e.g. "01:42 (+12:42)". */
  showElapsed?: boolean;
  timeZone?: string;
}

/**
 * A race time as the widgets show it: "01:42 (+12:42)". Falls back to the
 * elapsed time alone when the race start is unknown.
 */
export const formatRaceTime = (
  raceStartMs: number | null | undefined,
  elapsedSec: number,
  { showElapsed = true, timeZone }: RaceTimeOptions = {}
): string => {
  const epochMs = elapsedToEpochMs(raceStartMs, elapsedSec);
  const elapsed = formatElapsed(elapsedSec);
  if (epochMs === null) return elapsed;
  const clock = formatClock(epochMs, timeZone);
  return showElapsed ? `${clock} (${elapsed})` : clock;
};

/** A wait as "2h 10m" or "45m"; "now" once it has passed. */
export const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return 'now';
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
};

export const UNASSIGNED_DRIVER = 'Unassigned';
export const UNKNOWN_DRIVER = 'Unknown driver';

/** The driver's name from the planning; covers no driver and an unknown id. */
export const driverName = (
  planning: RacePlanning | null | undefined,
  driverId: number | null | undefined
): string => {
  if (driverId === null || driverId === undefined) return UNASSIGNED_DRIVER;
  return (
    planning?.drivers.find((driver) => driver.iracingId === driverId)?.name ??
    UNKNOWN_DRIVER
  );
};

/** The strategy in use: the snapshot's, then the configured one. */
export const selectStrategy = (
  state: RacePlanState | null | undefined,
  strategyId?: number | null
): RacePlanStrategy | null => {
  const strategies = state?.planning?.strategies ?? [];
  const id = strategyId ?? state?.strategyId ?? null;
  return (
    strategies.find((strategy) => strategy.id === id) ?? strategies[0] ?? null
  );
};

export const currentStint = (
  snapshot: Pick<RacePlanProgressSnapshot, 'stints' | 'currentStintIndex'>
): RacePlanProjectedStint | null =>
  snapshot.currentStintIndex === null
    ? null
    : (snapshot.stints[snapshot.currentStintIndex] ?? null);

const isAhead = (stint: RacePlanProjectedStint) =>
  stint.status === 'upcoming' || stint.status === 'unassigned';

/** The stint after the current one; the first stint before green. */
export const nextStint = (
  snapshot: Pick<RacePlanProgressSnapshot, 'stints' | 'currentStintIndex'>
): RacePlanProjectedStint | null => {
  const from = (snapshot.currentStintIndex ?? -1) + 1;
  return snapshot.stints.slice(from).find(isAhead) ?? null;
};

/** Stints still in the race: everything but dropped ones. */
export const plannedStintCount = (
  stints: readonly RacePlanProjectedStint[]
): number => stints.filter((stint) => stint.status !== 'dropped').length;

/**
 * The user's next stint that has not started yet; null when they have none
 * left or the id is unknown.
 */
export const findMyNextStint = (
  stints: readonly RacePlanProjectedStint[],
  userId: number | null | undefined
): RacePlanProjectedStint | null => {
  if (userId === null || userId === undefined) return null;
  return (
    stints.find(
      (stint) => stint.status === 'upcoming' && stint.driverId === userId
    ) ?? null
  );
};

/** Header line for the team view, e.g. "Your next stint in 2h 10m (01:42)". */
export const myNextStintText = (
  snapshot: Pick<
    RacePlanProgressSnapshot,
    'stints' | 'currentStintIndex' | 'elapsedSec' | 'raceStartMs'
  >,
  userId: number | null | undefined,
  options: RaceTimeOptions = {}
): string | null => {
  if (userId === null || userId === undefined) return null;
  const mine = snapshot.stints.filter((stint) => stint.driverId === userId);
  if (mine.length === 0) return null;
  if (currentStint(snapshot)?.driverId === userId) {
    const next = findMyNextStint(
      snapshot.stints.slice((snapshot.currentStintIndex ?? -1) + 1),
      userId
    );
    return next
      ? `You are driving now. Next stint in ${formatCountdown(next.startSec - snapshot.elapsedSec)}`
      : 'You are driving your last stint';
  }
  const next = findMyNextStint(snapshot.stints, userId);
  if (!next) return 'No more stints for you';
  const at = formatRaceTime(snapshot.raceStartMs, next.startSec, {
    ...options,
    showElapsed: false,
  });
  return `Your next stint in ${formatCountdown(next.startSec - snapshot.elapsedSec)} (${at})`;
};
