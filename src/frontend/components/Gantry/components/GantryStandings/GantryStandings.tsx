import { memo, useEffect, useRef, useMemo } from 'react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import { Compound } from '../../../Standings/components/Compound/Compound';
import { DriverRatingBadge } from '../../../Standings/components/DriverRatingBadge/DriverRatingBadge';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../../../Standings/components/DriverName/DriverName';
import type { Gap } from '../../../Standings/createStandings';
import { useDriverStandings } from '../../../Standings/hooks/useDriverStandings';
import { useHighlightColor } from '../../../Standings/hooks/useHighlightColor';

interface Props {
  standingsByClass: ReturnType<typeof useDriverStandings>;
  followedCarIdx: number | null;
}

const formatGap = (
  gap: Gap | undefined,
  position: number | undefined
): string => {
  if (position === 1) return 'gap';
  if (gap === undefined) return '-';
  if (gap.laps !== 0) return `${gap.laps}L`;
  if (gap.value !== undefined) return gap.value.toFixed(1);
  return '-';
};

const formatInterval = (
  interval: number | undefined,
  position: number | undefined
): string => {
  if (position === 1) return 'int';
  if (interval === undefined) return '-';
  return interval.toFixed(1);
};

export const GantryStandings = memo(
  ({ standingsByClass, followedCarIdx }: Props) => {
    const followedRef = useRef<HTMLDivElement | null>(null);
    const highlightColor = useHighlightColor();
    const highlightColorHex = `#${highlightColor.toString(16).padStart(6, '0')}`;

    useEffect(() => {
      followedRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }, [followedCarIdx]);

    const isMultiClass = standingsByClass.length > 1;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          {standingsByClass.map(([classId, classDrivers]) => {
            const firstDriver = classDrivers[0];
            const carClass = firstDriver?.carClass;
            const classColorHex =
              carClass?.color !== undefined
                ? `#${carClass.color.toString(16).padStart(6, '0')}`
                : '#94a3b8';
            return (
              <div key={classId}>
                {/* Class header */}
                <div
                  className="flex items-center gap-2 bg-slate-900 px-2 py-0.5 border-y border-slate-700/30"
                  style={{
                    borderLeftColor: classColorHex,
                    borderLeftWidth: 2,
                  }}
                >
                  <span
                    className="text-xs font-extrabold uppercase tracking-widest"
                    style={{ color: classColorHex }}
                  >
                    {carClass?.name}
                  </span>
                </div>
                {/* Driver rows */}
                {classDrivers.map((driver, idx) => (
                  <GantryDriverRow
                    key={driver.carIdx}
                    driver={driver}
                    idx={idx}
                    followedCarIdx={followedCarIdx}
                    followedRef={followedRef}
                    isMultiClass={isMultiClass}
                    highlightColorHex={highlightColorHex}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
GantryStandings.displayName = 'GantryStandings';

interface GantryDriverRowProps {
  driver: ReturnType<typeof useDriverStandings>[number][1][number];
  idx: number;
  followedCarIdx: number | null;
  followedRef: React.RefObject<HTMLDivElement | null>;
  isMultiClass: boolean;
  highlightColorHex: string;
}

const GantryDriverRow = memo(
  ({
    driver,
    idx,
    followedCarIdx,
    followedRef,
    isMultiClass,
    highlightColorHex,
  }: GantryDriverRowProps) => {
    const isPlayer = driver.isPlayer;
    const isFollowed = driver.carIdx === followedCarIdx;

    const tailwindStyles = useMemo(
      () => getTailwindStyle(driver.carClass.color, undefined, isMultiClass),
      [driver.carClass.color, isMultiClass]
    );

    const displayName = formatDriverName(
      extractDriverName(driver.driver.name, false),
      'surname'
    );

    const bestTimeStr = formatTime(driver.fastestTime);
    const lastTimeStr = formatTime(driver.lastTime);

    const lapDeltas = driver.lapTimeDeltas;
    // Show the last 3 deltas (most recent last) — map to L-3, L-2, L-1
    const numDeltas = 3;
    const deltaSlots = Array.from({ length: numDeltas }, (_, i) => {
      if (!lapDeltas || lapDeltas.length === 0) return undefined;
      const offset = lapDeltas.length - numDeltas + i;
      return offset >= 0 ? lapDeltas[offset] : undefined;
    });

    const pitLabel = driver.onPitRoad ? 'PIT' : driver.dnf ? 'DNF' : '';

    return (
      <div
        ref={isFollowed ? followedRef : undefined}
        style={
          isFollowed
            ? ({ '--tw-ring-color': highlightColorHex } as React.CSSProperties)
            : undefined
        }
        className={[
          'flex items-center px-1 py-px text-xs border-b border-white/5 transition-opacity duration-150',
          idx % 2 === 0 ? 'bg-slate-800/70' : 'bg-slate-900/70',
          isPlayer ? 'bg-yellow-500/20 text-amber-300' : '',
          isFollowed ? 'ring-1 relative z-10' : '',
          followedCarIdx !== null && !isFollowed ? 'opacity-40' : '',
          followedCarIdx === null && !driver.onTrack ? 'opacity-60' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* P */}
        <span
          className={`w-6 text-center font-bold ${tailwindStyles.classHeader} ${isPlayer ? 'text-amber-300' : 'text-white'}`}
        >
          {driver.classPosition ?? driver.position}
        </span>
        {/* # */}
        <span
          className={`w-8 text-center ${tailwindStyles.driverIcon} border-l-2 px-1 text-white`}
        >
          #{driver.driver.carNum}
        </span>
        {/* Driver Name */}
        <span className="flex-1 truncate px-1">{displayName}</span>
        {/* Tyre */}
        <span className="w-5 flex items-center justify-center">
          {driver.tireCompound !== undefined && driver.carId !== undefined && (
            <Compound tireCompound={driver.tireCompound} />
          )}
        </span>
        {/* iR */}
        <span className="w-16 flex items-center justify-end">
          <DriverRatingBadge
            license={driver.driver.license}
            rating={driver.driver.rating}
            format="rating-bw-no-license"
          />
        </span>
        {/* Pit */}
        <span className="w-5 text-center text-xs">
          {pitLabel && (
            <span
              className={
                driver.dnf
                  ? 'text-red-400 font-bold'
                  : 'text-yellow-400 font-bold'
              }
            >
              {pitLabel}
            </span>
          )}
        </span>
        {/* Gap */}
        <span className="w-12 text-right tabular-nums px-1">
          {formatGap(driver.gap, driver.classPosition ?? driver.position)}
        </span>
        {/* Interval */}
        <span className="w-12 text-right tabular-nums px-1">
          {formatInterval(
            driver.interval,
            driver.classPosition ?? driver.position
          )}
        </span>
        {/* Best */}
        <span
          className={`w-14 text-right tabular-nums gap-px-1 ${driver.hasFastestTime ? 'text-purple-400' : ''}`}
        >
          {bestTimeStr}
        </span>
        {/* Last */}
        <span
          className={`w-14 text-right tabular-nums px-2 ${
            driver.lastTimeState === 'session-fastest'
              ? 'text-purple-400'
              : driver.lastTimeState === 'personal-best'
                ? 'text-green-400'
                : ''
          }`}
        >
          {lastTimeStr}
        </span>
        {/* L-3, L-2, L-1 */}
        {deltaSlots.map((delta, i) => (
          <span
            key={i}
            className={`w-9 text-right tabular-nums px-0.5 ${
              delta !== undefined
                ? delta > 0
                  ? 'text-green-400'
                  : 'text-red-400'
                : ''
            }`}
          >
            {delta !== undefined
              ? Math.abs(delta).toFixed(1)
              : isPlayer
                ? '-'
                : ''}
          </span>
        ))}
      </div>
    );
  }
);
GantryDriverRow.displayName = 'GantryDriverRow';
