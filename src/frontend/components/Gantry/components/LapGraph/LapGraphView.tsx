import { t } from '@irdashies/frontend/i18n';
import { memo, useCallback, useMemo, useState } from 'react';
import { qualifyingGridSlots } from '@irdashies/domain/standings/useQualifyingGrid';
import {
  classReferenceLap,
  gapToClassLeader,
  positionsByLap,
  raceTrace,
  readCrossings,
  traceAnchor,
  type LapCrossing,
  type LapGraphMode,
  type LapPoint,
} from '@irdashies/domain';
import { useCurrentSessionType } from '@irdashies/context';
import { getTailwindStyle } from '@irdashies/utils/colors';
import type { LapGraphAxisFit, NameFormat } from '@irdashies/types';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../../../shared/DriverName/DriverName';
import { LapGraphCanvas } from './LapGraphCanvas';
import type { LapGraphSeries } from './LapGraphCanvas';
import { LapGraphDriverList } from './components/LapGraphDriverList/LapGraphDriverList';
import type { DriverListEntry } from './components/LapGraphDriverList/LapGraphDriverList';
import { GantryPanel } from '../GantryPanel/GantryPanel';
import { Tooltip } from '../Tooltip/Tooltip';
import { useGantrySettings } from '../../hooks/useGantrySettings';
import {
  useGantrySessionData,
  type GantrySessionData,
} from '../../hooks/useGantrySessionData';
import { autoPinCarIdxs } from './lapGraphAutoPin';
import { identityForGridSlot } from './lapGraphPalette';

/**
 * Fallback grid slot for a carIdx `qualifyingGridSlots` somehow has no entry
 * for. Unreachable in practice: the map is built from this exact class's
 * carIdx list, which always covers every member below.
 */
const FALLBACK_GRID_SLOT = 1;

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
  chosenAxisFit: LapGraphAxisFit | null;
  onAxisFitChange: (axisFit: LapGraphAxisFit) => void;
  chosenPins: readonly number[] | null;
  onPinsChange: (pins: readonly number[]) => void;
}

const CLASS_FILTER_TOOLTIP =
  "Chooses which car class the graph plots. Everything is measured against that class's leader, so only one class is shown at a time.";

const PANEL_TITLES: Record<LapGraphMode, string> = {
  trace: 'Race trace',
  position: 'Class position',
  gap: 'Gap to class leader',
};

const GROUP_LABEL_CLASS = 'text-sm text-slate-400';

const toggleClass = (isActive: boolean): string =>
  [
    'min-h-9 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors',
    isActive
      ? 'border-accent-500 bg-accent-500 text-on-accent'
      : 'border-settings-boundary bg-transparent text-slate-300 hover:border-slate-400',
  ].join(' ');

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

const AXIS_FIT_OPTIONS: {
  axisFit: LapGraphAxisFit;
  label: string;
  tooltip: string;
}[] = [
  {
    axisFit: 'shown',
    label: 'Shown',
    tooltip:
      'Sizes the axis to your car and the pinned cars only. A car far off the pace rides along the edge instead of squashing the battle you are watching.',
  },
  {
    axisFit: 'all',
    label: 'All',
    tooltip:
      'Sizes the axis to every car in the class, including the faint ones in the background.',
  },
];

/** Stable identity for "nothing pinned", so the canvas prop never churns. */
const EMPTY_PINS: readonly number[] = [];

/** One driver in the active class, with everything the chart needs to draw. */
interface ClassMember {
  carIdx: number;
  carNumber: string;
  displayName: string;
  isPlayer: boolean;
}

type ClassDrivers = GantrySessionData['standingsByClass'][number][1];

const buildMembers = (
  drivers: ClassDrivers,
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

/** Live class positions, as a primitive the side list can memoise on. */
const positionsSignature = (drivers: ClassDrivers): string =>
  drivers
    .map((d) => `${d.carIdx}:${d.classPosition ?? d.position ?? ''}`)
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
    chosenAxisFit,
    onAxisFitChange,
    chosenPins,
    onPinsChange,
  }: Props) => {
    const {
      standingsByClass,
      qualifyingResults,
      history,
      isReplayFile,
      isArchivedReplay,
      hasArchivedHistory,
    } = useGantrySessionData();
    const sessionType = useCurrentSessionType();
    const settings = useGantrySettings();
    const nameFormat = settings?.driverNameFormat ?? 'surname';
    const lapGraphSettings = settings?.lapGraph;

    // Settings supply the opening state. Once the user picks a mode or a pin in
    // this session their choice wins, so a saved default never fights them.
    const mode = chosenMode ?? lapGraphSettings?.yAxisMode ?? 'trace';
    const savedAxisFit = lapGraphSettings?.axisFit;
    const axisFit: LapGraphAxisFit =
      chosenAxisFit ?? (savedAxisFit === 'all' ? 'all' : 'shown');

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

    // Numeric class colour for LapGraphDriverList's car-number chip. The
    // list resolves it through getTailwindStyle itself, the same shared
    // helper the canvas class-selector buttons below use.
    const classColorValue = activeClass?.color ?? 0x94a3b8;

    // Player, class leader, and the cars either side of the player. Reduced to a
    // string first so a position reshuffle that does not change the set never
    // gives the canvas a new array.
    const autoPinKey = useMemo(() => {
      if (lapGraphSettings?.autoPin === false) return '';
      return autoPinCarIdxs(activeClass?.drivers ?? [], leaderCarIdx).join(',');
    }, [lapGraphSettings?.autoPin, activeClass, leaderCarIdx]);

    const autoPins = useMemo(
      () => (autoPinKey ? autoPinKey.split(',').map(Number) : EMPTY_PINS),
      [autoPinKey]
    );

    const pinnedCarIdxs = chosenPins ?? autoPins;

    // Hovering a name in the side list lifts that line above the field. It
    // outranks the Follow control for as long as the pointer is on the row.
    const [hoveredCarIdx, setHoveredCarIdx] = useState<number | null>(null);
    const focusedCarIdx = hoveredCarIdx ?? followedCarIdx;

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
    // array each time. Reduce it to a signature and hold the identity until the
    // content actually changes, or the series build runs for nothing.
    const memberList = useMemo(
      () => buildMembers(activeClass?.drivers ?? [], nameFormat),
      [activeClass, nameFormat]
    );
    const membersKey = useMemo(
      () => membersSignature(memberList),
      [memberList]
    );
    const members = useMemo(
      () => memberList,
      // Deliberately keyed on the content signature, not the list identity.
      // eslint-disable-next-line @eslint-react/exhaustive-deps
      [membersKey]
    );

    // carIdx never changes for a driver mid-race, so this only moves when the
    // class roster itself changes, not on every standings tick.
    const classCarIdxs = useMemo(
      () => members.map((member) => member.carIdx),
      [members]
    );
    const qualifyingGrid = useMemo(
      () => qualifyingGridSlots(qualifyingResults, classCarIdxs),
      [qualifyingResults, classCarIdxs]
    );

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

      // Read every car once: position mode ranks the whole class against
      // itself, so it needs the field before it can place any single car.
      const crossingsByCar = new Map<number, LapCrossing[]>();
      for (const member of members) {
        const crossings =
          member.carIdx === leaderCarIdx
            ? leaderCrossings
            : readCrossings(history, member.carIdx);
        if (crossings.length > 0) crossingsByCar.set(member.carIdx, crossings);
      }

      const positionPoints =
        mode === 'position' ? positionsByLap(crossingsByCar) : undefined;

      const series: LapGraphSeries[] = [];
      for (const member of members) {
        const crossings = crossingsByCar.get(member.carIdx);
        if (!crossings) continue;

        let points: LapPoint[];
        if (mode === 'position') {
          points = positionPoints?.get(member.carIdx) ?? [];
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

        const identity = identityForGridSlot(
          qualifyingGrid.get(member.carIdx) ?? FALLBACK_GRID_SLOT
        );
        series.push({
          carIdx: member.carIdx,
          carNumber: member.carNumber,
          displayName: member.displayName,
          isPlayer: member.isPlayer,
          color: identity.color,
          dash: identity.dash,
          points,
        });
      }

      return { series, reference };
    }, [history, mode, members, leaderCarIdx, qualifyingGrid]);

    const axisCaption = useMemo(
      () => axisCaptionFor(mode, built.reference),
      [mode, built.reference]
    );

    // Positions move on every standings tick. They are read here rather than
    // carried on `members`, so a place swap re-sorts the side list without
    // rebuilding a series for every car in the class.
    const positionsKey = useMemo(
      () => positionsSignature(activeClass?.drivers ?? []),
      [activeClass]
    );

    /** The whole class in running order, lapped or not, drawn or not. */
    const roster = useMemo<DriverListEntry[]>(() => {
      const drawn = new Set(built.series.map((entry) => entry.carIdx));
      const positions = new Map<number, number | undefined>(
        (activeClass?.drivers ?? []).map((driver) => [
          driver.carIdx,
          driver.classPosition ?? driver.position,
        ])
      );
      return members
        .map((member) => ({
          carIdx: member.carIdx,
          carNumber: member.carNumber,
          displayName: member.displayName,
          isPlayer: member.isPlayer,
          position: positions.get(member.carIdx),
          hasLine: drawn.has(member.carIdx),
          gridSlot: qualifyingGrid.get(member.carIdx) ?? FALLBACK_GRID_SLOT,
        }))
        .sort(
          (a, b) =>
            (a.position ?? Number.MAX_SAFE_INTEGER) -
            (b.position ?? Number.MAX_SAFE_INTEGER)
        );
      // Deliberately keyed on the positions signature, not the list identity.
      // eslint-disable-next-line @eslint-react/exhaustive-deps
    }, [members, built.series, positionsKey, qualifyingGrid]);

    const emptyMessage = useMemo(() => {
      if (sessionType && sessionType !== 'Race') {
        return 'The lap graph is available during a race.';
      }
      if (isReplayFile && !isArchivedReplay) {
        return 'No lap history was recorded on this PC for this replay.';
      }
      if (isArchivedReplay && !hasArchivedHistory) {
        return 'No laps were recorded on this PC for this session.';
      }
      if (!activeClass || leaderCarIdx === null) return 'Waiting for the grid.';
      if (mode === 'trace' && !built.reference) {
        return 'Waiting for the class leader to set a reference pace.';
      }
      return 'Waiting for the first completed lap.';
    }, [
      sessionType,
      isReplayFile,
      isArchivedReplay,
      hasArchivedHistory,
      activeClass,
      leaderCarIdx,
      mode,
      built.reference,
    ]);

    return (
      <GantryPanel label={t('Lap graph')}>
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-700 px-4 py-2.5">
          <h2 className="mr-auto text-lg leading-snug font-semibold text-slate-200">
            {t(PANEL_TITLES[mode])}
          </h2>
          {isMultiClass && (
            <div className="flex items-center gap-2">
              <Tooltip placement="bottom" content={t(CLASS_FILTER_TOOLTIP)}>
                <span
                  tabIndex={0}
                  className={`${GROUP_LABEL_CLASS} cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400`}
                >
                  {t('Class')}
                </span>
              </Tooltip>
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-label={t('Lap graph car class')}
              >
                {classes.map((cls) => (
                  <button
                    key={cls.classId}
                    type="button"
                    aria-pressed={cls.classId === activeClassId}
                    onClick={() => onClassChange(cls.classId)}
                    className={`${toggleClass(cls.classId === activeClassId)} flex items-center gap-1.5`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
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
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className={GROUP_LABEL_CLASS}>{t('Y axis')}</span>
            <div
              className="flex items-center gap-1.5"
              role="group"
              aria-label={t('Lap graph y axis mode')}
            >
              {MODE_OPTIONS.map((option) => (
                <Tooltip
                  key={option.mode}
                  placement="bottom"
                  content={t(option.tooltip)}
                >
                  <button
                    type="button"
                    aria-pressed={option.mode === mode}
                    onClick={() => onModeChange(option.mode)}
                    className={toggleClass(option.mode === mode)}
                  >
                    {t(option.label)}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>

          {mode !== 'position' && (
            <div className="flex items-center gap-2">
              <span className={GROUP_LABEL_CLASS}>{t('Range')}</span>
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-label={t('Lap graph y axis range')}
              >
                {AXIS_FIT_OPTIONS.map((option) => (
                  <Tooltip
                    key={option.axisFit}
                    placement="bottom"
                    content={t(option.tooltip)}
                  >
                    <button
                      type="button"
                      aria-pressed={option.axisFit === axisFit}
                      onClick={() => onAxisFitChange(option.axisFit)}
                      className={toggleClass(option.axisFit === axisFit)}
                    >
                      {t(option.label)}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 p-3">
            {built.series.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                {t(emptyMessage)}
              </div>
            ) : (
              <LapGraphCanvas
                series={built.series}
                mode={mode}
                axisCaption={axisCaption}
                pinnedCarIdxs={pinnedCarIdxs}
                focusedCarIdx={focusedCarIdx}
                onTogglePin={togglePin}
                defaultLapWindow={lapGraphSettings?.lapWindow}
                axisFit={axisFit}
                gapMaxSeconds={lapGraphSettings?.gapMaxSeconds}
              />
            )}
          </div>
          <aside
            aria-label={t('Drivers')}
            className="flex w-[260px] max-w-[40%] shrink-0 flex-col overflow-hidden border-l border-slate-700"
          >
            <div className="shrink-0 px-4 pt-3 pb-1.5 text-xs font-semibold tracking-[0.06em] text-slate-300 uppercase">
              {t('Drivers')}
            </div>
            <LapGraphDriverList
              drivers={roster}
              classColorValue={classColorValue}
              isMultiClass={isMultiClass}
              shownCarIdxs={pinnedCarIdxs}
              focusedCarIdx={focusedCarIdx}
              onToggle={togglePin}
              onHover={setHoveredCarIdx}
            />
          </aside>
        </div>
      </GantryPanel>
    );
  }
);
LapGraphView.displayName = 'LapGraphView';
