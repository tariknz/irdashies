import type {
  RacePlanProgressSnapshot,
  RacePlanState,
  RacePlanStintStatus,
  RacePlanning,
} from '@irdashies/types';
import {
  findClashes,
  type RacePlanClashLevel,
  type RacePlanStintClash,
} from './clashes';
import {
  driverName,
  formatRaceTime,
  myNextStintText,
  selectStrategy,
  type RaceTimeOptions,
} from './projection';
import {
  describeStop,
  driftLevel,
  driftText,
  recentUnplannedStops,
  type RacePlanDriftLevel,
} from './stintStatus';

type TimelineSnapshot = Pick<
  RacePlanProgressSnapshot,
  'stints' | 'raceStartMs' | 'elapsedSec' | 'status'
>;

export interface RacePlanTimelineRow {
  number: number;
  driverName: string;
  /** Driven, or to be driven, by the user of this client. */
  mine: boolean;
  status: RacePlanStintStatus;
  /** Null for an extra stint the plan does not have. */
  plannedStart: string | null;
  projectedStart: string;
  laps: number;
  rebuilt: boolean;
  clashLevel: RacePlanClashLevel | null;
  clashText: string | null;
}

export interface TimelineOptions extends RaceTimeOptions {
  /**
   * The plan's own race start, so planned times read as they do in the plan.
   * Falls back to the snapshot's race start.
   */
  planRaceStartMs?: number | null;
}

export const buildTimelineRows = (
  snapshot: TimelineSnapshot,
  planning: RacePlanning | null | undefined,
  userId: number | null | undefined,
  clashes: readonly RacePlanStintClash[],
  { planRaceStartMs, ...timeOptions }: TimelineOptions = {}
): RacePlanTimelineRow[] => {
  const byStint = new Map(clashes.map((clash) => [clash.stintNumber, clash]));
  const plannedBase = planRaceStartMs ?? snapshot.raceStartMs;
  return snapshot.stints.map((stint) => {
    const clash = byStint.get(stint.number);
    return {
      number: stint.number,
      driverName: driverName(planning, stint.driverId),
      mine:
        userId !== null && userId !== undefined && stint.driverId === userId,
      status: stint.status,
      plannedStart:
        stint.plannedStartSec === null
          ? null
          : formatRaceTime(plannedBase, stint.plannedStartSec, timeOptions),
      projectedStart: formatRaceTime(
        snapshot.raceStartMs,
        stint.startSec,
        timeOptions
      ),
      laps: stint.laps,
      rebuilt: stint.rebuilt,
      clashLevel: clash?.level ?? null,
      clashText: clash?.description ?? null,
    };
  });
};

export interface RacePlanStripSegment {
  number: number;
  status: RacePlanStintStatus;
  mine: boolean;
  leftPct: number;
  widthPct: number;
  clashLevel: RacePlanClashLevel | null;
}

export interface RacePlanStrip {
  segments: RacePlanStripSegment[];
  /** Where "now" is along the strip; null before the start. */
  nowPct: number | null;
  /** Race length the strip spans, in seconds. */
  spanSec: number;
}

const pct = (value: number, span: number) =>
  Math.round(Math.min(100, Math.max(0, (value / span) * 100)) * 100) / 100;

/** The whole race as a strip, dropped stints left out. */
export const buildStrip = (
  snapshot: TimelineSnapshot,
  userId: number | null | undefined,
  clashes: readonly RacePlanStintClash[]
): RacePlanStrip => {
  const kept = snapshot.stints.filter((stint) => stint.status !== 'dropped');
  const spanSec = Math.max(
    1,
    ...kept.map((stint) => stint.endSec),
    snapshot.elapsedSec
  );
  const byStint = new Map(clashes.map((clash) => [clash.stintNumber, clash]));
  const showNow =
    snapshot.elapsedSec >= 0 &&
    (snapshot.status === 'racing' || snapshot.status === 'finished');
  return {
    spanSec,
    nowPct: showNow ? pct(snapshot.elapsedSec, spanSec) : null,
    segments: kept.map((stint) => {
      const leftPct = pct(stint.startSec, spanSec);
      return {
        number: stint.number,
        status: stint.status,
        mine:
          userId !== null && userId !== undefined && stint.driverId === userId,
        leftPct,
        widthPct: Math.max(0, pct(stint.endSec, spanSec) - leftPct),
        clashLevel: byStint.get(stint.number)?.level ?? null,
      };
    }),
  };
};

export interface RacePlanStopRow {
  key: string;
  text: string;
  /** Time in the stall, e.g. "52s" or "3:05". */
  duration: string;
}

export interface StrategyTimelineView {
  /** "Your next stint in 2h 10m (01:42)"; null when the user is not in the plan. */
  header: string | null;
  driftText: string | null;
  driftLevel: RacePlanDriftLevel;
  rows: RacePlanTimelineRow[];
  strip: RacePlanStrip;
  /** Clock times at either end of the strip. */
  stripStart: string;
  stripEnd: string;
  stops: RacePlanStopRow[];
}

const stallTime = (seconds: number) => {
  const total = Math.round(seconds);
  return total < 60
    ? `${total}s`
    : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const buildStrategyTimelineView = (
  snapshot: RacePlanProgressSnapshot,
  planState: RacePlanState | null | undefined,
  userId: number | null | undefined,
  {
    showDoneStints = true,
    ...options
  }: TimelineOptions & {
    showDoneStints?: boolean;
  } = {}
): StrategyTimelineView => {
  const planning = planState?.planning ?? null;
  const strategy = selectStrategy(planState, snapshot.strategyId);
  const clashes = snapshotClashes(snapshot, planning, options.timeZone);
  const rows = buildTimelineRows(snapshot, planning, userId, clashes, {
    planRaceStartMs: strategy?.raceStartMs,
    ...options,
  });
  const strip = buildStrip(snapshot, userId, clashes);
  return {
    header: myNextStintText(snapshot, userId, options),
    driftText: driftText(snapshot.driftSec),
    driftLevel: driftLevel(snapshot.driftSec ?? 0),
    rows: showDoneStints ? rows : rows.filter((row) => row.status !== 'done'),
    strip,
    stripStart: formatRaceTime(snapshot.raceStartMs, 0, options),
    stripEnd: formatRaceTime(snapshot.raceStartMs, strip.spanSec, options),
    stops: recentUnplannedStops(snapshot.stops).map((stop) => ({
      key: `${stop.lap}-${stop.elapsedSec}`,
      text: describeStop(stop),
      duration: stallTime(stop.durationSec),
    })),
  };
};

/** Clashes for the snapshot's stints against the planning's availability. */
export const snapshotClashes = (
  snapshot: Pick<RacePlanProgressSnapshot, 'stints' | 'raceStartMs'>,
  planning: RacePlanning | null | undefined,
  timeZone?: string
): RacePlanStintClash[] =>
  findClashes(snapshot.stints, planning, snapshot.raceStartMs, timeZone);
