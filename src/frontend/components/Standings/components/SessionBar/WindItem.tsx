import { memo } from 'react';
import { useThrottledWeather, useTelemetryValue } from '@irdashies/context';
import type { SessionBarConfig } from '@irdashies/types';
import { WindArrow } from '../../../shared/WindArrow';

export const WindItem = memo(
  ({ settings }: { settings: SessionBarConfig['wind'] }) => {
    const displayUnits = useTelemetryValue('DisplayUnits'); // 0 = imperial, 1 = metric
    const { windDirection, windVelocity, windYaw } = useThrottledWeather();
    const relativeWindDirection = (windDirection ?? 0) - (windYaw ?? 0);
    const isMetric = displayUnits === 1;
    const speedPosition = settings?.speedPosition ?? 'right';
    const speed =
      windVelocity !== undefined
        ? Math.round(windVelocity * (isMetric ? 3.6 : 2.23694))
        : '-';
    const speedEl = <span>{speed}</span>;
    const arrowEl = (
      <WindArrow direction={relativeWindDirection} className="mx-1 w-3.5 h-4" />
    );
    return (
      <div className="flex justify-center gap-1 items-center">
        {speedPosition === 'left' && speedEl}
        {arrowEl}
        {speedPosition === 'right' && speedEl}
      </div>
    );
  }
);
WindItem.displayName = 'WindItem';
