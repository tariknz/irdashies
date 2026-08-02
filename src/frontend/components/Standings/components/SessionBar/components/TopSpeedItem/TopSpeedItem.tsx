import { memo } from 'react';
import { GaugeIcon } from '@phosphor-icons/react';
import {
  useLastLapTopSpeed,
  useSessionBestTopSpeed,
  useTelemetryValue,
} from '@irdashies/context';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const TopSpeedItem = memo(({ standalone }: SessionBarItemProps) => {
  const displayUnits = useTelemetryValue('DisplayUnits');
  const lastLapTopSpeedMs = useLastLapTopSpeed();
  const sessionBestTopSpeedMs = useSessionBestTopSpeed();

  const isMetric = displayUnits === 1;
  const factor = isMetric ? 3.6 : 2.23694;
  const unit = isMetric ? 'km/h' : 'mph';
  const last =
    lastLapTopSpeedMs !== null
      ? `${(lastLapTopSpeedMs * factor).toFixed(0)} ${unit}`
      : '—';
  const best =
    sessionBestTopSpeedMs !== null
      ? (sessionBestTopSpeedMs * factor).toFixed(0)
      : null;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center tabular-nums">
        <GaugeIcon />
        <span>{last}</span>
        {best && <span className="text-green-400">({best})</span>}
      </div>
    </div>
  );
});
TopSpeedItem.displayName = 'TopSpeedItem';
