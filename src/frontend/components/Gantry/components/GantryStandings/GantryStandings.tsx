import { memo, useCallback, useEffect, useRef, useMemo } from 'react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import logger from '@irdashies/utils/logger';
import { formatTime } from '@irdashies/utils/time';
import { Compound } from '../../../shared/Compound/Compound';
import { DriverRatingBadge } from '../../../shared/DriverRatingBadge/DriverRatingBadge';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../../../shared/DriverName/DriverName';
import { type Gap, useHighlightColor } from '@irdashies/domain';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { useLapTimesStoreUpdater } from '@irdashies/context';
import { Tooltip } from '../Tooltip/Tooltip';
import { useGantrySettings } from '../../hooks/useGantrySettings';
import type { NameFormat } from '@irdashies/types';

interface Props {
  followedCarIdx: number | null;
}

const DELTA_TOOLTIPS = [
  "How that driver's third-most-recent lap compared with your lap of the same age. Green means they were slower than you, red means faster.",
  "How that driver's second-most-recent lap compared with your lap of the same age. Green means they were slower than you, red means faster.",
  "How that driver's last completed lap compared with your last lap. Green means they were slower than you, red means faster.",
];

const HeaderCell = memo(
  ({
    label,
    tip,
    className,
  }: {
    label: string;
    tip: string;
    className: string;
  }) => (
    <Tooltip content={tip} placement="bottom">
      <span
        tabIndex={0}
        className={`${className} cursor-help focus:outline-none focus:ring-1 focus:ring-sky-400`}
      >
        <span className="text-[10px]">{label}</span>
      </span>
    </Tooltip>
  )
);
HeaderCell.displayName = 'HeaderCell';

/**
 * Widths for every column, shared by the header and the rows so the two cannot
 * drift apart. Sized in ch rather than px because the overlay theme scales the
 * font: a fixed pixel column clips the moment a user picks a larger size.
 *
 * Two rules keep the header over its values. shrink-0 stops a narrow window
 * squeezing a cell but not its header. And a ch resolves against the element's
 * own font size, so the header row must carry the same text-xs as the driver
 * rows — the smaller label type is set on the label span inside each cell.
 */
const COL = {
  position: 'w-6 shrink-0 text-center',
  carNumber: 'w-12 shrink-0 text-center border-l-2 px-1',
  name: 'flex-1 min-w-[8ch] truncate px-1',
  compound: 'w-5 shrink-0',
  rating: 'w-16 shrink-0',
  pit: 'w-5 shrink-0 text-center',
  gap: 'w-[6ch] shrink-0 px-1',
  interval: 'w-[6ch] shrink-0 px-1',
  best: 'w-[9ch] shrink-0 px-1',
  last: 'w-[9ch] shrink-0 px-1',
  delta: 'w-[6ch] shrink-0 px-1',
} as const;

const StandingsHeader = memo(() => (
  <div className="sticky top-0 z-20 flex items-center px-1 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-900 border-b border-slate-700/50">
    <HeaderCell
      label="P"
      tip="Running order within the car class. Rows are grouped by class, leader first."
      className={COL.position}
    />
    <HeaderCell
      label="#"
      tip="Car number. The coloured bar to its left is the car's class."
      className={`${COL.carNumber} border-transparent`}
    />
    <HeaderCell
      label="Driver"
      tip="Driver name, in the format set on the Gantry options tab. Click any row to point the sim camera at that car — this only does anything in a replay or while spectating."
      className={`${COL.name} text-left`}
    />
    <HeaderCell
      label="T"
      tip="Tyre compound currently fitted, for cars that report one."
      className={`${COL.compound} text-center`}
    />
    <HeaderCell
      label="iR"
      tip="Driver's iRating at the start of the event."
      className={`${COL.rating} text-right`}
    />
    <HeaderCell
      label="Pit"
      tip="Shows PIT while the car is on pit road, and DNF once it has retired or been disqualified."
      className={COL.pit}
    />
    <HeaderCell
      label="Gap"
      tip="Time behind the class leader. A value such as 1L means whole laps down; the leader's own row reads 'gap'."
      className={`${COL.gap} text-right`}
    />
    <HeaderCell
      label="Int"
      tip="Time behind the car directly ahead in class. The leader's own row reads 'int'."
      className={`${COL.interval} text-right`}
    />
    <HeaderCell
      label="Best"
      tip="Fastest lap this car has set in the session. Purple marks the fastest lap set by anyone."
      className={`${COL.best} text-right`}
    />
    <HeaderCell
      label="Last"
      tip="Most recently completed lap. Purple is a session best, green is that driver's personal best."
      className={`${COL.last} text-right`}
    />
    {(['L-3', 'L-2', 'L-1'] as const).map((label, i) => (
      <HeaderCell
        key={label}
        label={label}
        tip={DELTA_TOOLTIPS[i]}
        className={`${COL.delta} text-right`}
      />
    ))}
  </div>
));
StandingsHeader.displayName = 'StandingsHeader';

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

export const GantryStandings = memo(({ followedCarIdx }: Props) => {
  useLapTimesStoreUpdater(true);
  const nameFormat = useGantrySettings()?.driverNameFormat ?? 'surname';
  // Gap and interval are only calculated when the settings say they are
  // enabled, so passing nothing leaves both columns empty. The cast is needed
  // because the settings type marks these fields required.
  const standingsByClass = useDriverStandings(
    {
      gap: { enabled: true },
      interval: { enabled: true },
      lapTimeDeltas: { enabled: true, numLaps: 3 },
    } as Parameters<typeof useDriverStandings>[0],
    { showAll: true }
  );
  const followedRef = useRef<HTMLDivElement | null>(null);

  // Clicking a row points the sim's camera at that car. Only meaningful in a
  // replay or when spectating; iRacing ignores it while you are driving.
  const handleFocusDriver = useCallback((carNumber: string) => {
    window.raceControlBridge
      ?.focusDriver(carNumber)
      .catch((err) => logger.warn('[Gantry] focusDriver failed:', err));
  }, []);
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
      {/* One scroller for the header and the rows. A narrow window scrolls both
          together instead of shrinking the columns out of line. */}
      <div className="flex-1 min-h-0 overflow-auto scroll-pt-6">
        <div className="min-w-min">
          <StandingsHeader />
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
                  <Tooltip
                    content="Car class group. Position, gap and interval are all worked out within the class, not against the whole field."
                    placement="bottom"
                  >
                    <span
                      tabIndex={0}
                      className="text-xs font-extrabold uppercase tracking-widest cursor-help focus:outline-none focus:ring-1 focus:ring-sky-400"
                      style={{ color: classColorHex }}
                    >
                      {carClass?.name}
                    </span>
                  </Tooltip>
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
                    nameFormat={nameFormat}
                    onFocusDriver={handleFocusDriver}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
GantryStandings.displayName = 'GantryStandings';

interface GantryDriverRowProps {
  driver: ReturnType<typeof useDriverStandings>[number][1][number];
  idx: number;
  followedCarIdx: number | null;
  followedRef: React.RefObject<HTMLDivElement | null>;
  isMultiClass: boolean;
  highlightColorHex: string;
  nameFormat: NameFormat;
  onFocusDriver: (carNumber: string) => void;
}

const GantryDriverRow = memo(
  ({
    driver,
    idx,
    followedCarIdx,
    followedRef,
    isMultiClass,
    highlightColorHex,
    nameFormat,
    onFocusDriver,
  }: GantryDriverRowProps) => {
    const isPlayer = driver.isPlayer;
    const isFollowed = driver.carIdx === followedCarIdx;

    const tailwindStyles = useMemo(
      () => getTailwindStyle(driver.carClass.color, undefined, isMultiClass),
      [driver.carClass.color, isMultiClass]
    );

    const displayName = formatDriverName(
      extractDriverName(driver.driver.name, false),
      nameFormat
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
        role="button"
        tabIndex={0}
        title={`Click to point the sim camera at ${driver.driver.name} (works in a replay or while spectating)`}
        onClick={() => onFocusDriver(driver.driver.carNum)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFocusDriver(driver.driver.carNum);
          }
        }}
        style={
          isFollowed
            ? ({ '--tw-ring-color': highlightColorHex } as React.CSSProperties)
            : undefined
        }
        className={[
          'flex items-center px-1 py-px text-xs border-b border-white/5 transition-opacity duration-150',
          'cursor-pointer hover:bg-sky-500/20 focus:outline-none focus:ring-1 focus:ring-sky-400',
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
          className={`${COL.position} font-bold ${tailwindStyles.classHeader} ${isPlayer ? 'text-amber-300' : 'text-white'}`}
        >
          {driver.classPosition ?? driver.position}
        </span>
        {/* # */}
        <span
          className={`${COL.carNumber} tabular-nums ${tailwindStyles.driverIcon} text-white`}
        >
          #{driver.driver.carNum}
        </span>
        {/* Driver Name */}
        <span className={COL.name}>{displayName}</span>
        {/* Tyre */}
        <span className={`${COL.compound} flex items-center justify-center`}>
          {driver.tireCompound !== undefined && driver.carId !== undefined && (
            <Compound tireCompound={driver.tireCompound} />
          )}
        </span>
        {/* iR */}
        <span className={`${COL.rating} flex items-center justify-end`}>
          <DriverRatingBadge
            license={driver.driver.license}
            rating={driver.driver.rating}
            format="rating-bw-no-license"
          />
        </span>
        {/* Pit */}
        <span className={`${COL.pit} text-xs`}>
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
        <span className={`${COL.gap} text-right tabular-nums`}>
          {formatGap(driver.gap, driver.classPosition ?? driver.position)}
        </span>
        {/* Interval */}
        <span className={`${COL.interval} text-right tabular-nums`}>
          {formatInterval(
            driver.interval,
            driver.classPosition ?? driver.position
          )}
        </span>
        {/* Best */}
        <span
          className={`${COL.best} text-right tabular-nums ${driver.hasFastestTime ? 'text-purple-400' : ''}`}
        >
          {bestTimeStr}
        </span>
        {/* Last */}
        <span
          className={`${COL.last} text-right tabular-nums ${
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
            className={`${COL.delta} text-right tabular-nums ${
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
