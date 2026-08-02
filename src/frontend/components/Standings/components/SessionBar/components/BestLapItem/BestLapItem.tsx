import { memo } from 'react';
import { FlagIcon } from '@phosphor-icons/react';
import { useSessionBestLap, useTelemetryValue } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const BestLapItem = memo(({ standalone }: SessionBarItemProps) => {
  const bestLapTime = useTelemetryValue('LapBestLapTime');
  const sessionBestLap = useSessionBestLap();

  const pb = bestLapTime ?? 0;
  const color =
    pb > 0 && sessionBestLap !== undefined && pb <= sessionBestLap
      ? 'text-purple-400'
      : '';

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center tabular-nums">
        <FlagIcon />
        <span className={color}>{pb > 0 ? formatTime(pb, 'mixed') : '—'}</span>
      </div>
    </div>
  );
});
BestLapItem.displayName = 'BestLapItem';
