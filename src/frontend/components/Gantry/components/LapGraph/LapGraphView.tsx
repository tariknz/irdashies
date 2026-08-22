import { memo, useCallback, useMemo, useRef } from 'react';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import {
  classReferenceLap,
  gapToClassLeader,
  positionByLap,
  raceTrace,
  readCrossings,
  traceAnchor,
  type LapCrossing,
  type LapGraphMode,
  type LapPoint,
} from '@irdashies/domain';
import {
  useCurrentSessionType,
  useLapHistorySnapshot,
} from '@irdashies/context';
import { getTailwindStyle } from '@irdashies/utils/colors';
import type { LapHistorySnapshot, NameFormat } from '@irdashies/types';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../../../shared/DriverName/DriverName';
import { LapGraphCanvas } from './LapGraphCanvas';
import type { LapGraphSeries } from './LapGraphCanvas';
import { Tooltip } from '../Tooltip/Tooltip';
import { useGantrySettings } from '../../hooks/useGantrySettings';
import { autoPinCarIdxs } from './lapGraphAutoPin';

interface Props {
  /** Driver picked in the tab bar's Follow control, if any. */
  followedCarIdx: number | null;
  /**
   * View state is owned by Gantry so that switching tabs, which unmounts this
   * component, does not throw the user's choices away. null means "use the
   * saved setting".
   */
  selectedClassId: string | null;
  onClassChange: (classId: string) => void;
  chosenMode: LapGraphMode | null;
  onModeChange: (mode: LapGraphMode) => void;
  chosenPins: readonly number[] | null;
  onPinsChange: (pins: readonly number[]) => void;
}

const CLASS_FILTER_TOOLTIP =
  "Chooses which car class the graph plots. Everything is measured against that class's leader, so only one class is shown at a time.";

const MODE_OPTIONS: {
  mode: LapGraphMode;
  label: string;
  tooltip: string;
}[] = [
  {
    mode: 'trace',
    label: 'Trace',
    tooltip:
      'Time gained or lost against the reference lap, added up over the race. A flat line means running at reference pace. A step down is a pit stop.',
  },
  {
    mode: 'position',
    label: 'Position',
    tooltip:
      'Class position at the end of each lap. Position 1 sits at the top. Pit stops and being lapped do not distort it.',
  },
  {
    mode: 'gap',
    label: 'Gap',
    tooltip:
      'Seconds behind the class leader at the same lap count. Below zero means ahead of them.',
  },
];

/** One driver in the active class, with everything the chart needs to draw. */
/** Stable identity for "nothing pinned", so the canvas prop never churns. */
const EMPTY_PINS: readonly number[] = [];

interface ClassMember {
  carIdx: number;
  carNumber: string;
  displayName: string;
  isPlayer: boolean;
}

const buildMembers = (
  drivers: ReturnType<typeof useDriverStandings>[number][1],
  nameFormat: NameFormat
): ClassMember[] =>
  drivers.map((driver) => ({
    carIdx: driver.carIdx,
    carNumber: driver.driver.carNum,
    displayName: formatDriverName(
      extractDriverName(driver.driver.name, false),
      nameFormat
    ),
    isPlayer: driver.isPlayer,
  }));

const membersSignature = (members: readonly ClassMember[]): string =>
  members
    .map((m) => `${m.carIdx}|${m.carNumber}|${m.displayName}|${m.isPlayer}`)
    .join(',');

const axisCaptionFor = (
  mode: LapGraphMode,
  reference: { seconds: number; source: 'median' | 'fastest' } | undefined
): string => {
  if (mode === 'position') return 'Class position, 1 at the top.';
  if (mode === 'gap') {
    return 'Seconds behind the class leader, lower is better. Below zero is ahead of them.';
  }
  const basis =
    reference?.source === 'fastest'
      ? "the class leader's fastest lap so far"
      : "the class leader's median green lap, excluding the opening lap";
  return `Seconds gained or lost against reference pace, from the first racing lap. Higher is better, and a flat line is running at that pace. Reference is ${basis}.`;
};

export const LapGraphView = memo(
  ({
    followedCarIdx,
    selectedClassId,
    onClassChange,
    chosenMode,
    onModeChange,
    chosenPins,
    onPinsChange,
  }: Props) => {
    const standingsByClass = useDriverStandings(undefined, { showAll: true });
    const snapshot = useLapHistorySnapshot();
    const sessionType = useCurrentSessionType();
    const settings = useGantrySettings();
    const nameFormat = settings?.driverNameFormat ?? 'surname';
    const lapGraphSettings = settings?.lapGraph;

    // Settings supply the opening state. Once the user picks a mode or a pin in
    // this session their choice wins, so a saved default never fights them.
    const mode = chosenMode ?? lapGraphSettings?.yAxisMode ?? 'trace';

    const classes = useMemo(
      () =>
        standingsByClass.map(([classId, drivers]) => {
          const first = drivers[0];
          return {
            classId,
            name: first?.carClass.name ?? classId,
            color: first?.carClass.color ?? 0x94a3b8,
            drivers,
          };
        }),
      [standingsByClass]
    );

    const isMultiClass = classes.length > 1;

    const defaultClassId = useMemo(() => {
      for (const cls of classes) {
        if (cls.drivers.some((d) => d.isPlayer)) return cls.classId;
      }
      return classes[0]?.classId ?? null;
    }, [classes]);

    // A class the user picked can disappear — a multi-class session dropping to
    // one class hides the selector entirely — which would otherwise leave the
    // chart permanently empty. Fall back to the default whenever the selection
    // is no longer on the grid.
    const activeClassId =
      selectedClassId !== null &&
      classes.some((c) => c.classId === selectedClassId)
        ? selectedClassId
        : defaultClassId;

    const activeClass = useMemo(
      () => classes.find((c) => c.classId === activeClassId),
      [classes, activeClassId]
    );

    /** Lowest in-class position on the grid right now. A primitive, so it only
     * invalidates the series when the class lead actually changes. */
    const leaderCarIdx = useMemo(() => {
      let best: number | null = null;
      let bestPosition = Number.MAX_SAFE_INTEGER;
      for (const driver of activeClass?.drivers ?? []) {
        const position = driver.classPosition ?? Number.MAX_SAFE_INTEGER;
        if (position > 0 && position < bestPosition) {
          bestPosition = position;
          best = driver.carIdx;
        }
      }
      return best;
    }, [activeClass]);

    const classColor = useMemo(
      () =>
        getTailwindStyle(
          activeClass?.color ?? 0x94a3b8,
          undefined,
          isMultiClass
        ).canvasFill,
      [activeClass, isMultiClass]
    );

    // Player, class leader, and the cars either side of the player. Cached behind
    // the resulting carIdx list so a position reshuffle that does not change the
    // set never re-renders the canvas.
    const autoPinCache = useRef<{ signature: string; pins: number[] }>({
      signature: '',
      pins: [],
    });

    const autoPins = useMemo(() => {
      if (lapGraphSettings?.autoPin === false) return EMPTY_PINS;
      const pins = autoPinCarIdxs(activeClass?.drivers ?? [], leaderCarIdx);
      const signature = pins.join(',');
      if (signature === autoPinCache.current.signature) {
        return autoPinCache.current.pins;
      }
      autoPinCache.current = { signature, pins };
      return pins;
    }, [lapGraphSettings?.autoPin, activeClass, leaderCarIdx]);

    const pinnedCarIdxs = chosenPins ?? autoPins;

    const togglePin = useCallback(
      (carIdx: number) => {
        const base = chosenPins ?? autoPins;
        onPinsChange(
          base.includes(carIdx)
            ? base.filter((idx) => idx !== carIdx)
            : [...base, carIdx]
        );
      },
      [chosenPins, autoPins, onPinsChange]
    );

    // Standings rebuild on every 5 Hz snapshot, so the driver list is a fresh
    // array each time. Cache it behind a signature to keep the series memo from
    // seeing a change that is not one.
    const memberCache = useRef<{ signature: string; members: ClassMember[] }>({
      signature: '',
      members: [],
    });

    const members = useMemo(() => {
      const next = buildMembers(activeClass?.drivers ?? [], nameFormat);
      const signature = membersSignature(next);
      if (signature === memberCache.current.signature) {
        return memberCache.current.members;
      }
      memberCache.current = { signature, members: next };
      return next;
    }, [activeClass, nameFormat]);

    // Hold the snapshot at an identity that only moves when `version` moves, so
    // a republished but unchanged history never rebuilds 60 series.
    const historyCache = useRef<{
      version: number;
      snapshot: LapHistorySnapshot | undefined;
    }>({ version: -1, snapshot: undefined });

    if (!snapshot) {
      historyCache.current = { version: -1, snapshot: undefined };
    } else if (snapshot.version !== historyCache.current.version) {
      historyCache.current = { version: snapshot.version, snapshot };
    }
    const history = historyCache.current.snapshot;

    const built = useMemo(() => {
      const empty = { series: [] as LapGraphSeries[], reference: undefined };
      if (!history || members.length === 0 || leaderCarIdx === null)
        return empty;

      const leaderCrossings = readCrossings(history, leaderCarIdx);
      const reference = classReferenceLap(leaderCrossings);
      if (mode === 'trace' && !reference) return empty;

      // One anchor for the whole chart. A per-car origin would shift every line
      // by its own offset and destroy the comparison between them.
      const anchor = reference
        ? traceAnchor(leaderCrossings, reference.seconds)
        : undefined;

      const series: LapGraphSeries[] = [];
      for (const member of members) {
        const crossings: LapCrossing[] =
          member.carIdx === leaderCarIdx
            ? leaderCrossings
            : readCrossings(history, member.carIdx);
        if (crossings.length === 0) continue;

        let points: LapPoint[];
        if (mode === 'position') {
          points = positionByLap(crossings);
        } else if (mode === 'gap') {
          points = gapToClassLeader(crossings, leaderCrossings);
        } else if (reference && anchor) {
          points = raceTrace(
            crossings,
            reference.seconds,
            anchor.originSeconds,
            anchor.fromLap
          );
        } else {
          continue;
        }
        if (points.length === 0) continue;

        series.push({
          carIdx: member.carIdx,
          carNumber: member.carNumber,
          displayName: member.displayName,
          isPlayer: member.isPlayer,
          color: classColor,
          points,
        });
      }

      return { series, reference };
    }, [history, mode, members, leaderCarIdx, classColor]);

    const axisCaption = useMemo(
      () => axisCaptionFor(mode, built.reference),
      [mode, built.reference]
    );

    const emptyMessage = useMemo(() => {
      if (sessionType && sessionType !== 'Race') {
        return 'The lap graph is available during a race.';
      }
      if (!activeClass || leaderCarIdx === null) return 'Waiting for the grid.';
      if (mode === 'trace' && !built.reference) {
        return 'Waiting for the class leader to set a reference pace.';
      }
      return 'Waiting for the first completed lap.';
    }, [sessionType, activeClass, leaderCarIdx, mode, built.reference]);

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-4 px-3 py-1.5 border-b border-slate-700/50 shrink-0">
          {isMultiClass && (
            <div className="flex items-center gap-2">
              <Tooltip placement="bottom" content={CLASS_FILTER_TOOLTIP}>
                <span
                  tabIndex={0}
                  className="text-xs text-slate-500 font-bold uppercase tracking-wider cursor-help focus:outline-none focus:ring-1 focus:ring-sky-400 rounded"
                >
                  Class
                </span>
              </Tooltip>
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label="Lap graph car class"
              >
                {classes.map((cls) => {
                  const isActive = cls.classId === activeClassId;
                  return (
                    <button
                      key={cls.classId}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onClassChange(cls.classId)}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors',
                        isActive
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200',
                      ].join(' ')}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: getTailwindStyle(
                            cls.color,
                            undefined,
                            isMultiClass
                          ).canvasFill,
                        }}
                      />
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Y axis
            </span>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Lap graph y axis mode"
            >
              {MODE_OPTIONS.map((option) => {
                const isActive = option.mode === mode;
                return (
                  <Tooltip
                    key={option.mode}
                    placement="bottom"
                    content={option.tooltip}
                  >
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onModeChange(option.mode)}
                      className={[
                        'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors',
                        isActive
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-3">
          {built.series.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm text-center px-4">
              {emptyMessage}
            </div>
          ) : (
            <LapGraphCanvas
              series={built.series}
              mode={mode}
              axisCaption={axisCaption}
              pinnedCarIdxs={pinnedCarIdxs}
              focusedCarIdx={followedCarIdx}
              onTogglePin={togglePin}
              defaultLapWindow={lapGraphSettings?.lapWindow}
            />
          )}
        </div>
      </div>
    );
  }
);
LapGraphView.displayName = 'LapGraphView';
