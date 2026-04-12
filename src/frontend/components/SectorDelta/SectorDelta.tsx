import React from 'react';
import { useSectorDeltas } from '@irdashies/context';
import { useSessionVisibility, useTelemetryValue } from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import type { SectorColor } from '@irdashies/context';

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

function formatDelta(
  lapTime: number | null,
  bestTime: number | null,
  decimalPlaces: number
): string {
  if (lapTime === null) return '--';
  if (bestTime === null) return lapTime.toFixed(decimalPlaces);
  const delta = lapTime - bestTime;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(decimalPlaces)}`;
}

export const SectorDelta = ({
  background,
  showOnlyWhenOnTrack,
  sessionVisibility,
  decimalPlaces = 3,
}: SectorDeltaProps): React.JSX.Element | null => {
  const {
    sectors,
    sectorColors,
    currentLapSectorTimes,
    sessionBestSectorTimes,
    currentSectorIdx,
  } = useSectorDeltas();
  const isOnTrack = useTelemetryValue('IsOnTrack');

  if (!useSessionVisibility(sessionVisibility)) return null;
  if (showOnlyWhenOnTrack && !isOnTrack) return null;
  if (sectors.length === 0) return null;

  const opacity = (background?.opacity ?? 80) / 100;

  return (
    <div
      className="flex flex-row gap-1 p-1 rounded-sm"
      style={{ backgroundColor: `rgba(15, 23, 42, ${opacity})` }}
    >
      {sectors.map((sector, i) => {
        const isCurrent = i === currentSectorIdx;
        const colorKey: SectorColor | 'current' = isCurrent
          ? 'current'
          : (sectorColors[i] ?? 'default');
        const delta = formatDelta(
          currentLapSectorTimes[i] ?? null,
          sessionBestSectorTimes[i] ?? null,
          decimalPlaces
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
  );
};
