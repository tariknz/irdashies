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
} from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { useBattleSettings } from './hooks/useBattleSettings';
import { useDriverRelatives, useHighlightColor } from '../Standings/hooks';

// Format an absolute gap value for display
const formatGap = (gap: number | null | undefined, dp: number): string => {
  if (gap == null || !isFinite(gap)) return '—';
  return `${Math.abs(gap).toFixed(dp)}s`;
};

type Trend = 'good' | 'bad' | 'flat' | 'none';

/**
 * Compute the delta trend for the AHEAD car.
 * gapAhead is a negative number (ahead car is in front).
 * Smaller absolute value = gap closing = GOOD for player (green).
 * Larger absolute value = gap growing = BAD for player (red).
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
    trend: delta < 0 ? 'good' : 'bad', // closing = good
  };
};

/**
 * Compute the delta trend for the BEHIND car.
 * gapBehind is a positive number (behind car is behind us).
 * Smaller absolute value = gap shrinking = BAD for player (red).
 * Larger absolute value = gap growing = GOOD for player (green).
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
    trend: delta < 0 ? 'bad' : 'good', // closing = bad
  };
};

const trendClass = (trend: Trend) => {
  if (trend === 'good') return 'text-green-400';
  if (trend === 'bad') return 'text-red-400';
  if (trend === 'flat') return 'text-slate-400';
  return 'text-transparent';
};

interface BattleRowProps {
  position?: number;
  classPosition?: number;
  carNum?: string;
  name: string;
  stintLaps?: number;
  lastTime?: number;
  lastTimeFormat?: import('@irdashies/types').TimeFormat;
  /** Formatted live gap string */
  gap?: string;
  /** Formatted previous-lap gap string */
  prevGap?: string;
  delta?: { text: string; trend: Trend };
  isPlayer?: boolean;
  highlightColor?: number;
  settings?: ReturnType<typeof useBattleSettings>;
  displayOrder?: string[];
  /** Whether the gap columns should render at all (controls width reservation) */
  showGapColumns: boolean;
}

const BattleRow = memo(
  ({
    position,
    classPosition,
    carNum,
    name,
    stintLaps,
    lastTime,
    lastTimeFormat = 'mixed',
    gap,
    prevGap,
    delta,
    isPlayer,
    highlightColor,
    settings,
    displayOrder = [],
    showGapColumns,
  }: BattleRowProps) => {
    const rowBg = isPlayer ? 'bg-amber-300/20' : 'bg-slate-700/70';
    const textColor = isPlayer ? 'text-amber-300' : 'text-white';
    const mutedColor = isPlayer ? 'text-amber-300/60' : 'text-white/55';
    const highlightStyle =
      isPlayer && highlightColor
        ? { color: `#${highlightColor.toString(16).padStart(6, '0')}` }
        : {};

    const cols: React.JSX.Element[] = [];
    const ordered = displayOrder.length
      ? displayOrder
      : ['position', 'carNumber', 'driverName', 'stint', 'lastTime', 'gap'];

    for (const key of ordered) {
      if (key === 'position' && settings?.position?.enabled) {
        cols.push(
          <td
            key="pos"
            className={`px-1 whitespace-nowrap text-center w-0 ${textColor}`}
            style={highlightStyle}
          >
            {position != null ? `P${position}` : '—'}
            {classPosition != null && classPosition !== position ? (
              <span className={`ml-0.5 ${mutedColor}`}>C{classPosition}</span>
            ) : null}
          </td>
        );
      } else if (key === 'carNumber' && settings?.carNumber?.enabled) {
        cols.push(
          <td key="carnum" className="px-0 w-0">
            {carNum != null && (
              <span className="inline-block bg-sky-900 border-l-2 border-sky-400 text-white px-1.5 py-0.5 min-w-7 text-center">
                #{carNum}
              </span>
            )}
          </td>
        );
      } else if (key === 'driverName' && settings?.driverName?.enabled) {
        cols.push(
          <td
            key="name"
            className={`px-1.5 w-full truncate max-w-0 ${textColor}`}
            style={highlightStyle}
          >
            {name || '—'}
          </td>
        );
      } else if (key === 'stint' && settings?.stint?.enabled) {
        cols.push(
          <td
            key="stint"
            className={`px-1.5 whitespace-nowrap tabular-nums text-center w-0 ${mutedColor}`}
          >
            {stintLaps != null && stintLaps > 0 ? `${stintLaps}L` : '—'}
          </td>
        );
      } else if (key === 'lastTime' && settings?.lastTime?.enabled) {
        cols.push(
          <td
            key="last"
            className={`px-1.5 whitespace-nowrap tabular-nums text-right w-0 ${textColor}`}
          >
            {lastTime && lastTime > 0
              ? formatTime(lastTime, lastTimeFormat)
              : '—'}
          </td>
        );
      } else if (key === 'gap' && settings?.gap?.enabled) {
        // Always render the three gap cells to keep column widths stable.
        // On the player row (or when there's no opponent) they're blank.
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

    return <tr className={`${rowBg} rounded-sm`}>{cols}</tr>;
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

  usePitLapStoreUpdater();

  const relatives = useDriverRelatives({ buffer: 1 });
  const pitLaps = usePitLap();
  const carLaps = useCarLap();
  const gapSnapshot = useBattleGapSnapshot();

  const playerEntry = useMemo(
    () => relatives.find((r) => r.isPlayer),
    [relatives]
  );

  const aheadEntry = useMemo(() => {
    if (!playerEntry) return undefined;
    const playerRelIdx = relatives.indexOf(playerEntry);
    return playerRelIdx > 0 ? relatives[playerRelIdx - 1] : undefined;
  }, [relatives, playerEntry]);

  const behindEntry = useMemo(() => {
    if (!playerEntry) return undefined;
    const playerRelIdx = relatives.indexOf(playerEntry);
    return playerRelIdx < relatives.length - 1
      ? relatives[playerRelIdx + 1]
      : undefined;
  }, [relatives, playerEntry]);

  // Live gaps from useDriverRelatives delta.
  // aheadEntry.delta is negative (car is in front).
  // behindEntry.delta is positive (car is behind).
  const liveGapAhead = aheadEntry?.delta ?? null;
  const liveGapBehind = behindEntry != null ? -(behindEntry.delta ?? 0) : null;

  useBattleGapStoreUpdater({ liveGapAhead, liveGapBehind });

  const stintLaps = (carIdx: number) => {
    const currentLap = carLaps?.[carIdx] ?? 0;
    const lastPit = pitLaps?.[carIdx] ?? 0;
    if (currentLap <= 0) return undefined;
    return lastPit > 0 ? currentLap - lastPit : currentLap;
  };

  const dp = settings?.gap?.decimalPlaces ?? 2;
  const timeFormat = settings?.lastTime?.timeFormat ?? 'mixed';
  const displayOrder = settings?.displayOrder;

  // Compact mode from general settings
  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';
  const tableBorderSpacing = isCompact
    ? 'border-spacing-y-0'
    : 'border-spacing-y-0.5';

  if (!isSessionVisible) return <></>;
  if (settings?.showOnlyWhenOnTrack && !isDriving) return <></>;
  if (!playerEntry && focusCarIdx === undefined) return <></>;

  // Whether gap columns are enabled at all
  const gapEnabled = settings?.gap?.enabled ?? true;

  return (
    <div
      className="w-full bg-slate-800/(--bg-opacity) rounded-sm overflow-hidden"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <div className={`${isCompact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`}>
        <table
          className={`w-full table-auto text-sm border-separate ${tableBorderSpacing}`}
        >
          <tbody>
            {/* Ahead row — shows live gap */}
            <BattleRow
              position={aheadEntry?.position}
              classPosition={aheadEntry?.classPosition}
              carNum={aheadEntry?.driver?.carNum}
              name={aheadEntry?.driver?.name ?? ''}
              stintLaps={aheadEntry ? stintLaps(aheadEntry.carIdx) : undefined}
              lastTime={aheadEntry?.lastTime}
              lastTimeFormat={timeFormat}
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
              settings={settings}
              displayOrder={displayOrder}
              showGapColumns={aheadEntry != null}
            />
            {/* Player row */}
            <BattleRow
              position={playerEntry?.position}
              classPosition={playerEntry?.classPosition}
              carNum={playerEntry?.driver?.carNum}
              name={playerEntry?.driver?.name ?? ''}
              stintLaps={
                playerEntry ? stintLaps(playerEntry.carIdx) : undefined
              }
              lastTime={playerEntry?.lastTime}
              lastTimeFormat={timeFormat}
              isPlayer
              highlightColor={highlightColor}
              settings={settings}
              displayOrder={displayOrder}
              showGapColumns={false}
            />
            {/* Behind row — shows live gap */}
            <BattleRow
              position={behindEntry?.position}
              classPosition={behindEntry?.classPosition}
              carNum={behindEntry?.driver?.carNum}
              name={behindEntry?.driver?.name ?? ''}
              stintLaps={
                behindEntry ? stintLaps(behindEntry.carIdx) : undefined
              }
              lastTime={behindEntry?.lastTime}
              lastTimeFormat={timeFormat}
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
              settings={settings}
              displayOrder={displayOrder}
              showGapColumns={behindEntry != null}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
};
