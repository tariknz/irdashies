import React, { useEffect } from 'react';
import { useSectorDeltas, useSectorTimingStore } from '@irdashies/context';
import { useSessionVisibility, useTelemetryValue } from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import type { TimeFormat } from '@irdashies/types';
import type { SectorColor } from '@irdashies/context';
import { useReferenceLapSectorTimes } from './hooks/useReferenceLapSectorTimes';
import { formatTime } from '@irdashies/utils/time';

type SectorDeltaProps = SectorDeltaConfig;

const SECTOR_BG: Record<SectorColor | 'current', string> = {
  purple: 'bg-purple-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
  red: 'bg-red-600',
  default: 'bg-slate-700/80',
  current: 'bg-slate-300/80',
};

const SECTOR_TEXT: Record<SectorColor | 'current', string> = {
  purple: 'text-white',
  green: 'text-white',
  yellow: 'text-black',
  red: 'text-white',
  default: 'text-slate-400',
  current: 'text-slate-800',
};

const GHOST_THRESHOLD = 0.5;

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

function ghostColor(
  lapTime: number | null,
  refTime: number | null
): SectorColor {
  if (lapTime === null || refTime === null) return 'default';
  const delta = lapTime - refTime;
  if (delta <= 0) return 'green';
  if (delta <= GHOST_THRESHOLD) return 'yellow';
  return 'red';
}

export const SectorDelta = ({
  background,
  showOnlyWhenOnTrack,
  sessionVisibility,
  timeFormat = 'full',
  showGhostLap = true,
  thresholds,
}: SectorDeltaProps): React.JSX.Element | null => {
  const {
    sectors,
    sectorColors,
    currentLapSectorTimes,
    previousLapSectorTimes,
    sessionBestSectorTimes,
    currentSectorIdx,
  } = useSectorDeltas();
  const isOnTrack = useTelemetryValue('IsOnTrack');
  const { refSectorTimes, hasGhostLap } = useReferenceLapSectorTimes();

  const setThresholds = useSectorTimingStore((s) => s.setThresholds);
  useEffect(() => {
    const green = (thresholds?.green ?? 0.5) / 100;
    const yellow = (thresholds?.yellow ?? 1.0) / 100;
    setThresholds(green, yellow);
  }, [thresholds, setThresholds]);

  if (!useSessionVisibility(sessionVisibility)) return null;
  if (showOnlyWhenOnTrack && !isOnTrack) return null;
  if (sectors.length === 0) return null;

  const opacity = (background?.opacity ?? 80) / 100;

  return (
    <div
      className="flex flex-col gap-1 p-1 rounded-sm"
      style={{ backgroundColor: `rgba(15, 23, 42, ${opacity})` }}
    >
      {/* Session-best delta row */}
      <div className="flex flex-row gap-1">
        {sectors.map((sector, i) => {
          const isCurrent = i === currentSectorIdx;
          const displayTime = isCurrent
            ? null
            : (currentLapSectorTimes[i] ?? previousLapSectorTimes[i] ?? null);
          const colorKey: SectorColor | 'current' = isCurrent
            ? 'current'
            : (sectorColors[i] ?? 'default');
          const delta = formatDelta(
            displayTime,
            sessionBestSectorTimes[i] ?? null,
            timeFormat
          );
          return (
            <div
              key={sector.SectorNum}
              className={[
                'flex flex-col items-center justify-center rounded-sm px-2 py-1 flex-1 min-w-0',
                SECTOR_BG[colorKey],
              ].join(' ')}
            >
              <span className="text-xs font-semibold text-white/70 leading-none mb-0.5">
                S{sector.SectorNum + 1}
              </span>
              <span
                className={[
                  'text-sm font-mono font-bold leading-none tabular-nums',
                  SECTOR_TEXT[colorKey],
                ].join(' ')}
              >
                {delta}
              </span>
            </div>
          );
        })}
      </div>

      {/* Ghost lap delta row — only shown when a ghost file is loaded and enabled */}
      {showGhostLap && hasGhostLap && (
        <div className="flex flex-row gap-1">
          {sectors.map((sector, i) => {
            const isCurrent = i === currentSectorIdx;
            const displayTime = isCurrent
              ? null
              : (currentLapSectorTimes[i] ?? previousLapSectorTimes[i] ?? null);
            const colorKey: SectorColor | 'current' = isCurrent
              ? 'current'
              : ghostColor(displayTime, refSectorTimes[i] ?? null);
            const delta = formatDelta(
              displayTime,
              refSectorTimes[i] ?? null,
              timeFormat
            );
            return (
              <div
                key={sector.SectorNum}
                className={[
                  'flex flex-col items-center justify-center rounded-sm px-2 py-1 flex-1 min-w-0',
                  SECTOR_BG[colorKey],
                ].join(' ')}
              >
                <span className="text-xs font-semibold text-white/70 leading-none mb-0.5">
                  G{sector.SectorNum + 1}
                </span>
                <span
                  className={[
                    'text-sm font-mono font-bold leading-none tabular-nums',
                    SECTOR_TEXT[colorKey],
                  ].join(' ')}
                >
                  {delta}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
