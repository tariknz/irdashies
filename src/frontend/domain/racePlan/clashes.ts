import type {
  RacePlanAvailability,
  RacePlanProjectedStint,
  RacePlanning,
} from '@irdashies/types';
import { elapsedToEpochMs, formatClock } from './projection';

/** `clash`: the driver is unavailable. `warning`: they are only maybe available. */
export type RacePlanClashLevel = 'clash' | 'warning';

export interface RacePlanStintClash {
  stintNumber: number;
  level: RacePlanClashLevel;
  /** Tooltip text, e.g. "Projected 07:52–08:53, unavailable from 07:30". */
  description: string;
}

const overlaps = (
  startMs: number,
  endMs: number,
  window: RacePlanAvailability
) => startMs < window.endMs && endMs > window.startMs;

const CHECKED = new Set<RacePlanProjectedStint['status']>([
  'current',
  'upcoming',
]);

const windowText = (
  level: RacePlanClashLevel,
  window: RacePlanAvailability,
  stintEndMs: number,
  timeZone: string | undefined
) => {
  const what = level === 'clash' ? 'unavailable' : 'maybe unavailable';
  // A window that ends mid-stint is told by when the driver is back.
  return window.endMs < stintEndMs
    ? `${what} until ${formatClock(window.endMs, timeZone)}`
    : `${what} from ${formatClock(window.startMs, timeZone)}`;
};

/**
 * Checks one projected stint against its driver's availability. An
 * unavailable window wins over a maybe; the earliest window of that kind is
 * described.
 */
export const findStintClash = (
  stint: RacePlanProjectedStint,
  availability: readonly RacePlanAvailability[],
  raceStartMs: number | null | undefined,
  timeZone?: string
): RacePlanStintClash | null => {
  if (!CHECKED.has(stint.status) || stint.driverId === null) return null;
  const startMs = elapsedToEpochMs(raceStartMs, stint.startSec);
  const endMs = elapsedToEpochMs(raceStartMs, stint.endSec);
  if (startMs === null || endMs === null) return null;

  const hits = availability
    .filter((window) => window.status !== 'available')
    .filter((window) => overlaps(startMs, endMs, window))
    .sort((a, b) => a.startMs - b.startMs);
  const window =
    hits.find((hit) => hit.status === 'unavailable') ??
    hits.find((hit) => hit.status === 'maybe');
  if (!window) return null;

  const level: RacePlanClashLevel =
    window.status === 'unavailable' ? 'clash' : 'warning';
  const projected = `Projected ${formatClock(startMs, timeZone)}–${formatClock(endMs, timeZone)}`;
  return {
    stintNumber: stint.number,
    level,
    description: `${projected}, ${windowText(level, window, endMs, timeZone)}`,
  };
};

/** Clashes and warnings for every stint that has not finished, in stint order. */
export const findClashes = (
  stints: readonly RacePlanProjectedStint[],
  planning: RacePlanning | null | undefined,
  raceStartMs: number | null | undefined,
  timeZone?: string
): RacePlanStintClash[] => {
  if (!planning) return [];
  const availability = new Map(
    planning.drivers.map((driver) => [driver.iracingId, driver.availability])
  );
  return stints.flatMap((stint) => {
    const windows =
      stint.driverId === null ? undefined : availability.get(stint.driverId);
    const clash = windows
      ? findStintClash(stint, windows, raceStartMs, timeZone)
      : null;
    return clash ? [clash] : [];
  });
};

export interface RacePlanClashSummary {
  clashes: number;
  warnings: number;
  /** One description per line, for a tooltip. */
  text: string;
}

export const summarizeClashes = (
  clashes: readonly RacePlanStintClash[]
): RacePlanClashSummary => ({
  clashes: clashes.filter((clash) => clash.level === 'clash').length,
  warnings: clashes.filter((clash) => clash.level === 'warning').length,
  text: clashes
    .map((clash) => `Stint ${clash.stintNumber}: ${clash.description}`)
    .join('\n'),
});
