import { memo } from 'react';
import { TimerIcon } from '@phosphor-icons/react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const LastLapItem = memo(({ standalone }: SessionBarItemProps) => {
  const { lastLapTime, bestLapTime, sessionBestLap } =
    useSessionBarSnapshot() ?? {};

  const t = lastLapTime ?? 0;
  const pb = bestLapTime ?? 0;
  const color =
    t > 0 && sessionBestLap !== undefined && t <= sessionBestLap
      ? 'text-purple-400'
      : t > 0 && pb > 0 && t <= pb
        ? 'text-green-400'
        : '';

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center tabular-nums">
        <TimerIcon />
        <span className={color}>{t > 0 ? formatTime(t, 'mixed') : '—'}</span>
      </div>
    </div>
  );
});
LastLapItem.displayName = 'LastLapItem';
