import { memo, useMemo } from 'react';
import {
  useDrivingState,
  useSessionVisibility,
  usePitLapStoreUpdater,
  usePitLap,
  useCarLap,
  useFocusCarIdx,
  useGeneralSettings,
  useBattleGapStoreUpdater,
  useBattleGapSnapshot,
  useWeekendInfoNumCarClasses,
  useCarIdxSpeed,
  useTelemetryValue,
  useSessionStore,
} from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { useBattleSettings } from './hooks/useBattleSettings';
import { useHighlightColor, useDriverRelatives } from '../Standings/hooks';
import { useDriverStandings } from '../Standings/hooks/useDriverPositions';
import { useDriverLivePositions } from '../Standings/hooks/useDriverLivePositions';
import type { Standings } from '../Standings/createStandings';

// Format an absolute gap value for display
const formatGap = (gap: number | null | undefined, dp: number): string => {
  if (gap == null || !isFinite(gap)) return '—';
  return `${Math.abs(gap).toFixed(dp)}s`;
};

type Trend = 'good' | 'bad' | 'flat' | 'none';

/**
 * Delta for the AHEAD car.
 * Gap closing (absolute value shrinking) = GOOD (green).
 */
const aheadDelta = (
  liveGap: number | null,
  prevGap: number | null,
  dp: number
): { text: string; trend: Trend } => {
  if (liveGap == null || prevGap == null) return { text: '', trend: 'none' };
  const delta = Math.abs(liveGap) - Math.abs(prevGap);
  if (Math.abs(delta) < 0.005) return { text: '—', trend: 'flat' };
  return {
    text: `${Math.abs(delta).toFixed(dp)}s`,
    trend: delta < 0 ? 'good' : 'bad',
  };
};

/**
 * Delta for the BEHIND car.
 * Gap shrinking (car behind catching up) = BAD (red).
 */
const behindDelta = (
  liveGap: number | null,
  prevGap: number | null,
  dp: number
): { text: string; trend: Trend } => {
  if (liveGap == null || prevGap == null) return { text: '', trend: 'none' };
  const delta = Math.abs(liveGap) - Math.abs(prevGap);
  if (Math.abs(delta) < 0.005) return { text: '—', trend: 'flat' };
  return {
    text: `${Math.abs(delta).toFixed(dp)}s`,
    trend: delta < 0 ? 'bad' : 'good',
  };
};

const trendClass = (trend: Trend) => {
  if (trend === 'good') return 'text-green-400';
  if (trend === 'bad') return 'text-red-400';
  if (trend === 'flat') return 'text-slate-400';
  return 'text-transparent';
};

interface BattleRowProps {
  entry?: Standings;
  liveClassPosition?: number;
  gap?: string;
  prevGap?: string;
  delta?: { text: string; trend: Trend };
  isPlayer?: boolean;
  highlightColor?: number;
  isMultiClass: boolean;
  settings?: ReturnType<typeof useBattleSettings>;
  displayOrder?: string[];
  showGapColumns: boolean;
  stintLaps?: number;
  lastTimeFormat?: import('@irdashies/types').TimeFormat;
  speedKph?: number;
  isMetricSpeed?: boolean;
  rowIndex: number;
}

const BattleRow = memo(
  ({
    entry,
    liveClassPosition,
    gap,
    prevGap,
    delta,
    isPlayer,
    highlightColor,
    isMultiClass,
    settings,
    displayOrder = [],
    showGapColumns,
    stintLaps,
    lastTimeFormat = 'mixed',
    speedKph,
    isMetricSpeed = true,
    rowIndex,
  }: BattleRowProps) => {
    const onTrack = entry?.onTrack ?? true;
    const onPitRoad = entry?.onPitRoad ?? false;
    const isLapped = entry?.lappedState === 'behind';
    const isLappingAhead = entry?.lappedState === 'ahead';
    const offTrack = entry?.carTrackSurface === 0;

    // Match Relative/DriverInfoRow row className pattern exactly.
    const rowClasses = [
      !onTrack || onPitRoad ? 'text-white/60' : '',
      isPlayer ? 'text-amber-300' : '',
      isPlayer
        ? 'bg-yellow-500/20'
        : rowIndex % 2 === 0
          ? 'bg-slate-800/70'
          : 'bg-slate-900/70',
      !isPlayer && isLapped ? 'text-blue-400' : '',
      !isPlayer && isLappingAhead ? 'text-red-400' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const mutedColor = 'text-white/55';
    const highlightStyle =
      isPlayer && highlightColor
        ? { color: `#${highlightColor.toString(16).padStart(6, '0')}` }
        : {};

    const tailwindStyles = useMemo(
      () =>
        getTailwindStyle(entry?.carClass?.color, highlightColor, isMultiClass),
      [entry?.carClass?.color, highlightColor, isMultiClass]
    );

    const cols: React.JSX.Element[] = [];
    const ordered = displayOrder.length
      ? displayOrder
      : [
          'position',
          'carNumber',
          'driverName',
          'stint',
          'lastTime',
          'speed',
          'gap',
        ];

    for (const key of ordered) {
      if (key === 'position' && settings?.position?.enabled) {
        // Match PositionCell: plain number, class-colour bg for player,
        // off-track yellow override. No P/C prefix.
        const positionBg = offTrack
          ? 'bg-yellow-400'
          : isPlayer
            ? tailwindStyles.classHeader
            : '';
        const positionText = offTrack ? 'text-yellow-900' : '';
        cols.push(
          <td
            key="pos"
            className={`w-auto text-center px-2 whitespace-nowrap ${positionBg} ${positionText}`}
            style={highlightStyle}
          >
            {(() => {
              const p = liveClassPosition ?? entry?.classPosition;
              return p !== undefined && isFinite(p) ? p : '—';
            })()}
          </td>
        );
      } else if (key === 'carNumber' && settings?.carNumber?.enabled) {
        cols.push(
          <td
            key="carnum"
            className={`w-auto ${entry != null ? `${tailwindStyles.driverIcon} border-l-4` : ''} text-white text-right px-1 whitespace-nowrap`}
          >
            {entry != null ? `#${entry.driver?.carNum}` : ''}
          </td>
        );
      } else if (key === 'driverName' && settings?.driverName?.enabled) {
        cols.push(
          <td
            key="name"
            className="px-1 py-0.5 w-full truncate max-w-0"
            style={highlightStyle}
          >
            {entry?.driver?.name || '—'}
          </td>
        );
      } else if (key === 'stint' && settings?.stint?.enabled) {
        cols.push(
          <td
            key="stint"
            className={`px-2 whitespace-nowrap tabular-nums text-center w-auto ${mutedColor}`}
          >
            {stintLaps != null && stintLaps > 0 ? `${stintLaps}L` : '—'}
          </td>
        );
      } else if (key === 'lastTime' && settings?.lastTime?.enabled) {
        // Match LastTimeCell: session-fastest purple, personal-best green.
        const lastTimeColor =
          entry?.lastTimeState === 'session-fastest'
            ? 'text-purple-400'
            : entry?.lastTimeState === 'personal-best'
              ? 'text-green-400'
              : '';
        cols.push(
          <td
            key="last"
            className={`w-auto px-2 whitespace-nowrap ${lastTimeColor}`}
          >
            {entry?.lastTime && entry.lastTime > 0
              ? formatTime(entry.lastTime, lastTimeFormat)
              : '—'}
          </td>
        );
      } else if (key === 'speed' && settings?.speed?.enabled) {
        const displaySpeed =
          speedKph != null && speedKph > 0
            ? Math.round(isMetricSpeed ? speedKph : speedKph / 1.60934)
            : null;
        cols.push(
          <td
            key="speed"
            className={`px-1.5 whitespace-nowrap tabular-nums text-right w-0 ${mutedColor}`}
          >
            {displaySpeed != null ? `${displaySpeed}` : '—'}
          </td>
        );
      } else if (key === 'gap' && settings?.gap?.enabled) {
        const deltaVal = delta ?? { text: '', trend: 'none' as Trend };
        const showData = !isPlayer && showGapColumns;
        cols.push(
          <td
            key="gap"
            className={`px-1.5 whitespace-nowrap tabular-nums text-right w-0 border-l border-white/10 ${showData ? 'text-white/85' : 'text-transparent'}`}
          >
            {showData ? (gap ?? '—') : '—'}
          </td>,
          <td
            key="prev"
            className={`px-1.5 whitespace-nowrap tabular-nums text-right w-0 text-white/40 ${!showData ? 'text-transparent' : ''}`}
          >
            {showData ? (prevGap ?? '—') : '—'}
          </td>,
          <td
            key="delta"
            className={`pr-2 whitespace-nowrap tabular-nums text-right w-0 ${showData ? trendClass(deltaVal.trend) : 'text-transparent'}`}
          >
            {showData &&
            deltaVal.trend !== 'none' &&
            deltaVal.trend !== 'flat' ? (
              <>
                {deltaVal.trend === 'good' ? '\u25BC' : '\u25B2'}{' '}
                {deltaVal.text}
              </>
            ) : showData ? (
              deltaVal.text
            ) : (
              '—'
            )}
          </td>
        );
      }
    }

    return <tr className={rowClasses}>{cols}</tr>;
  }
);
BattleRow.displayName = 'BattleRow';

export const Battle = () => {
  const settings = useBattleSettings();
  const generalSettings = useGeneralSettings();
  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const focusCarIdx = useFocusCarIdx();
  const highlightColor = useHighlightColor();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;

  usePitLapStoreUpdater();

  // Full driver list with metadata (name, car class, etc.). NOTE: this list's
  // ordering is by SDK CarIdxPosition which only updates at the start/finish line,
  // so we never use its index ordering — we re-sort by live class position below.
  const allStandings = useDriverStandings();

  // Live class positions: derived from CarIdxLapCompleted + CarIdxLapDistPct,
  // updates every frame, grouped by class, pace car already excluded.
  // This is what makes mid-lap overtakes appear immediately in the widget.
  const liveClassPositions = useDriverLivePositions({ enabled: true });

  // useDriverRelatives provides live (60fps, reference-lap interpolated) gap timing.
  // Use a large buffer so the entire field is included with live deltas attached —
  // we look up the position-neighbours by carIdx, so they must always be present
  // regardless of physical track proximity.
  const relatives = useDriverRelatives({ buffer: 64 });

  // Pace car must be excluded from neighbour selection. useDriverStandings does
  // not filter it (only useDriverRelatives does), so we filter it here too.
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  const pitLaps = usePitLap();
  const carLaps = useCarLap();
  const gapSnapshot = useBattleGapSnapshot();

  // Build a carIdx → live delta map from relatives for O(1) lookups.
  // Updates every frame as relatives recomputes from telemetry.
  const relativeDeltaMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of relatives) {
      if (r.delta != null) map.set(r.carIdx, r.delta);
    }
    return map;
  }, [relatives]);

  // Identify player and position-neighbours by LIVE class position.
  // Steps:
  //   1. Find the player in allStandings (just to grab their class id + entry).
  //   2. Filter standings to the player's class, exclude pace car.
  //   3. Sort by liveClassPositions[carIdx] — this updates every frame.
  //   4. Pick the entries immediately above and below the player.
  // Falls back to standings classPosition (CarIdxClassPosition) when live positions
  // are unavailable (non-race sessions, replay, etc).
  const { playerEntry, aheadEntry, behindEntry, positionFor } = useMemo(() => {
    const player = allStandings.find((s) => s.isPlayer);
    if (!player)
      return {
        playerEntry: undefined,
        aheadEntry: undefined,
        behindEntry: undefined,
      };

    const playerClassId = player.carClass?.id;
    const hasLivePositions = Object.keys(liveClassPositions).length > 0;

    const sameClass = allStandings.filter(
      (s) => s.carIdx !== paceCarIdx && s.carClass?.id === playerClassId
    );

    const positionFor = (carIdx: number): number | undefined => {
      const pos = hasLivePositions
        ? liveClassPositions[carIdx]
        : sameClass.find((s) => s.carIdx === carIdx)?.classPosition;
      return pos !== undefined && isFinite(pos) ? pos : undefined;
    };

    sameClass.sort((a, b) => {
      const pa = positionFor(a.carIdx) ?? Infinity;
      const pb = positionFor(b.carIdx) ?? Infinity;
      return pa - pb;
    });

    const playerIdx = sameClass.findIndex((s) => s.isPlayer);
    if (playerIdx === -1)
      return {
        playerEntry: player,
        aheadEntry: undefined,
        behindEntry: undefined,
      };

    return {
      playerEntry: sameClass[playerIdx],
      aheadEntry: playerIdx > 0 ? sameClass[playerIdx - 1] : undefined,
      behindEntry:
        playerIdx < sameClass.length - 1 ? sameClass[playerIdx + 1] : undefined,
      positionFor,
    };
  }, [allStandings, liveClassPositions, paceCarIdx]);

  // Live gaps from the reference-lap-interpolated deltas (updates every frame).
  // relatives delta: positive = car is ahead of player, negative = car is behind.
  const liveGapAhead = useMemo(() => {
    if (!aheadEntry) return null;
    const d = relativeDeltaMap.get(aheadEntry.carIdx);
    return d != null ? Math.abs(d) : null;
  }, [aheadEntry, relativeDeltaMap]);

  const liveGapBehind = useMemo(() => {
    if (!behindEntry) return null;
    const d = relativeDeltaMap.get(behindEntry.carIdx);
    return d != null ? Math.abs(d) : null;
  }, [behindEntry, relativeDeltaMap]);

  useBattleGapStoreUpdater({ liveGapAhead, liveGapBehind });

  // Speed: derived from CarIdxLapDistPct movement, in km/h.
  const carSpeeds = useCarIdxSpeed();
  const displayUnits = useTelemetryValue('DisplayUnits'); // 0 = imperial, 1 = metric
  const speedUnit = settings?.speed?.unit ?? 'auto';
  const isMetricSpeed =
    speedUnit === 'auto' ? displayUnits === 1 : speedUnit === 'km/h';

  const stintLaps = (carIdx: number) => {
    const currentLap = carLaps?.[carIdx] ?? 0;
    const lastPit = pitLaps?.[carIdx] ?? 0;
    if (currentLap <= 0) return undefined;
    return lastPit > 0 ? currentLap - lastPit : currentLap;
  };

  const dp = settings?.gap?.decimalPlaces ?? 2;
  const timeFormat = settings?.lastTime?.timeFormat ?? 'mixed';
  const displayOrder = settings?.displayOrder;
  const gapEnabled = settings?.gap?.enabled ?? true;

  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';
  const tableBorderSpacing = isCompact
    ? 'border-spacing-y-0'
    : 'border-spacing-y-0.5';

  if (!isSessionVisible) return <></>;
  if (settings?.showOnlyWhenOnTrack && !isDriving) return <></>;
  if (!playerEntry && focusCarIdx === undefined) return <></>;

  return (
    <div
      className={`w-full bg-slate-800/(--bg-opacity) rounded-sm ${!isCompact ? 'p-2' : ''} overflow-hidden`}
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <table
        className={`w-full table-auto text-sm border-separate ${tableBorderSpacing}`}
      >
        <tbody>
          <BattleRow
            entry={aheadEntry}
            liveClassPosition={
              aheadEntry ? positionFor?.(aheadEntry.carIdx) : undefined
            }
            gap={gapEnabled ? formatGap(liveGapAhead, dp) : undefined}
            prevGap={
              gapEnabled ? formatGap(gapSnapshot.gapAhead, dp) : undefined
            }
            delta={
              gapEnabled
                ? aheadDelta(liveGapAhead, gapSnapshot.gapAhead, dp)
                : undefined
            }
            isPlayer={false}
            highlightColor={highlightColor}
            isMultiClass={isMultiClass}
            settings={settings}
            displayOrder={displayOrder}
            showGapColumns={aheadEntry != null}
            stintLaps={aheadEntry ? stintLaps(aheadEntry.carIdx) : undefined}
            lastTimeFormat={timeFormat}
            speedKph={
              aheadEntry != null ? carSpeeds[aheadEntry.carIdx] : undefined
            }
            isMetricSpeed={isMetricSpeed}
            rowIndex={0}
          />
          <BattleRow
            entry={playerEntry}
            liveClassPosition={
              playerEntry ? positionFor?.(playerEntry.carIdx) : undefined
            }
            isPlayer
            highlightColor={highlightColor}
            isMultiClass={isMultiClass}
            settings={settings}
            displayOrder={displayOrder}
            showGapColumns={false}
            stintLaps={playerEntry ? stintLaps(playerEntry.carIdx) : undefined}
            lastTimeFormat={timeFormat}
            speedKph={
              playerEntry != null ? carSpeeds[playerEntry.carIdx] : undefined
            }
            isMetricSpeed={isMetricSpeed}
            rowIndex={1}
          />
          <BattleRow
            entry={behindEntry}
            liveClassPosition={
              behindEntry ? positionFor?.(behindEntry.carIdx) : undefined
            }
            gap={gapEnabled ? formatGap(liveGapBehind, dp) : undefined}
            prevGap={
              gapEnabled ? formatGap(gapSnapshot.gapBehind, dp) : undefined
            }
            delta={
              gapEnabled
                ? behindDelta(liveGapBehind, gapSnapshot.gapBehind, dp)
                : undefined
            }
            isPlayer={false}
            highlightColor={highlightColor}
            isMultiClass={isMultiClass}
            settings={settings}
            displayOrder={displayOrder}
            showGapColumns={behindEntry != null}
            stintLaps={behindEntry ? stintLaps(behindEntry.carIdx) : undefined}
            lastTimeFormat={timeFormat}
            speedKph={
              behindEntry != null ? carSpeeds[behindEntry.carIdx] : undefined
            }
            isMetricSpeed={isMetricSpeed}
            rowIndex={2}
          />
        </tbody>
      </table>
    </div>
  );
};
