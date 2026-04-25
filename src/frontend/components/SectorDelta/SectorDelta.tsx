import { useEffect } from 'react';
import { GhostIcon, WarningIcon } from '@phosphor-icons/react';
import { useSectorDeltas, useSectorTimingStore } from '@irdashies/context';
import {
  useSessionVisibility,
  useTelemetryValue,
  useTelemetryValueRounded,
} from '@irdashies/context';
import { useReferenceLapSectorTimes } from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import type { TimeFormat } from '@irdashies/types';
import type { SectorColor } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { useLiveSectorDelta } from './hooks/useLiveSectorDelta';
import {
  computeGhostSectorColor,
  getSectorDeltaThresholdFractions,
} from './sectorColorUtils';

type SectorDeltaProps = SectorDeltaConfig;

const SECTOR_CARD: Record<
  SectorColor,
  { bg: string; accent: string; text: string }
> = {
  purple: {
    bg: 'bg-slate-800/80',
    accent: 'border-b-[5px] border-purple-400',
    text: 'text-white',
  },
  green: {
    bg: 'bg-slate-800/80',
    accent: 'border-b-[5px] border-green-400',
    text: 'text-white',
  },
  yellow: {
    bg: 'bg-slate-800/80',
    accent: 'border-b-[5px] border-yellow-400',
    text: 'text-white',
  },
  red: {
    bg: 'bg-slate-800/80',
    accent: 'border-b-[5px] border-red-500',
    text: 'text-white',
  },
  default: {
    bg: 'bg-slate-800/40',
    accent: 'border-b-[5px] border-slate-700',
    text: 'text-slate-400',
  },
};

function timeFormatToDecimalPlaces(timeFormat: TimeFormat): number {
  if (timeFormat === 'full' || timeFormat === 'seconds-full') return 3;
  if (timeFormat === 'mixed' || timeFormat === 'seconds-mixed') return 1;
  return 0;
}

function formatDelta(
  lapTime: number | null,
  bestTime: number | null,
  timeFormat: TimeFormat
): string {
  if (lapTime === null) return '--';
  if (bestTime === null) return formatTime(lapTime, timeFormat);
  const delta = lapTime - bestTime;
  const sign = delta >= 0 ? '+' : '';
  const dp = timeFormatToDecimalPlaces(timeFormat);
  return `${sign}${delta.toFixed(dp)}`;
}

export const SectorDelta = ({
  background,
  showOnlyWhenOnTrack,
  sessionVisibility,
  timeFormat = 'full',
  ghostComparison = 'prefer-ghost',
  thresholds,
}: SectorDeltaProps) => {
  const {
    sectors,
    sectorColors,
    currentLapSectorTimes,
    currentLapSectorUnclean,
    previousLapSectorTimes,
    previousLapSectorUnclean,
    sessionBestSectorTimes,
    currentSectorIdx,
  } = useSectorDeltas();
  const isOnTrack = useTelemetryValue('IsOnTrack');
  // 3dp ≈ 5m on a 5km track — sub-pixel for the sector progress bar.
  const lapDistPct = useTelemetryValueRounded('LapDistPct', 3) ?? 0;
  const { refSectorTimes, hasGhostLap } = useReferenceLapSectorTimes();

  const useGhost = ghostComparison === 'prefer-ghost' && hasGhostLap;
  const liveSectorDelta = useLiveSectorDelta(useGhost);

  // How far (0–1) through the current sector the player is
  const sectorStart = sectors[currentSectorIdx]?.SectorStartPct ?? 0;
  const sectorEnd = sectors[currentSectorIdx + 1]?.SectorStartPct ?? 1;
  const sectorProgress =
    sectorEnd > sectorStart
      ? Math.max(
          0,
          Math.min(1, (lapDistPct - sectorStart) / (sectorEnd - sectorStart))
        )
      : 0;

  const setThresholds = useSectorTimingStore((s) => s.setThresholds);
  useEffect(() => {
    const { green, yellow } = getSectorDeltaThresholdFractions(thresholds);
    setThresholds(green, yellow);
  }, [thresholds, setThresholds]);

  if (!useSessionVisibility(sessionVisibility)) return null;
  if (showOnlyWhenOnTrack && !isOnTrack) return null;
  if (sectors.length === 0) return null;

  const opacity = (background?.opacity ?? 80) / 100;

  return (
    <div
      className="flex flex-row items-center gap-1 p-1 rounded-sm"
      style={{ backgroundColor: `rgba(15, 23, 42, ${opacity})` }}
    >
      {useGhost && (
        <div className="flex items-center justify-center px-1 text-slate-400 flex-shrink-0">
          <GhostIcon size={14} weight="fill" />
        </div>
      )}
      {sectors.map((sector, i) => {
        const isCurrent = i === currentSectorIdx;
        const displayTime = isCurrent
          ? (previousLapSectorTimes[i] ?? null)
          : (currentLapSectorTimes[i] ?? previousLapSectorTimes[i] ?? null);
        const isUnclean = isCurrent
          ? previousLapSectorUnclean[i]
          : currentLapSectorTimes[i] != null
            ? currentLapSectorUnclean[i]
            : previousLapSectorUnclean[i];

        const colorKey: SectorColor = useGhost
          ? computeGhostSectorColor(
              displayTime,
              refSectorTimes[i] ?? null,
              thresholds
            )
          : (sectorColors[i] ?? 'default');

        const refTime = useGhost
          ? (refSectorTimes[i] ?? null)
          : (sessionBestSectorTimes[i] ?? null);

        const dp = timeFormatToDecimalPlaces(timeFormat);
        const delta =
          isCurrent && liveSectorDelta !== null
            ? `${liveSectorDelta >= 0 ? '+' : ''}${liveSectorDelta.toFixed(dp)}`
            : formatDelta(displayTime, refTime, timeFormat);
        const card = SECTOR_CARD[colorKey];

        return (
          <div
            key={sector.SectorNum}
            className={[
              'relative flex flex-col items-center justify-center rounded-sm px-2 py-1 flex-1 min-w-0 overflow-hidden',
              card.bg,
              card.accent,
            ].join(' ')}
          >
            <span className="text-xs font-semibold text-slate-400 leading-none mb-0.5">
              S{sector.SectorNum + 1}
            </span>
            <span
              className={[
                'inline-flex items-center gap-1 text-sm font-bold leading-none tabular-nums',
                card.text,
                isCurrent ? 'opacity-70' : '',
              ].join(' ')}
            >
              <span>{delta}</span>
              {isUnclean && (
                <WarningIcon
                  size={10}
                  weight="fill"
                  className="text-amber-300 shrink-0"
                />
              )}
            </span>
            {isCurrent && (
              <>
                <div
                  className="absolute top-0 left-0 bottom-0 transition-[width] duration-200 ease-linear"
                  style={{
                    width: `${sectorProgress * 100}%`,
                    backgroundColor: 'rgba(56, 189, 248, 0.4)',
                  }}
                />
                <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-sky-400" />
                <div
                  className="absolute top-0 left-0 h-[2px] bg-sky-400 transition-[width] duration-200 ease-linear"
                  style={{ width: `${sectorProgress * 100}%` }}
                />
                <div
                  className="absolute bottom-0 left-0 h-[2px] bg-sky-400 transition-[width] duration-200 ease-linear"
                  style={{ width: `${sectorProgress * 100}%` }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
