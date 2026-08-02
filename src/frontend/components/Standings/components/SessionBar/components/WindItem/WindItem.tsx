import { memo } from 'react';
import { useTelemetryValue, useThrottledWeather } from '@irdashies/context';
import { WindArrow } from '../../../../../shared/WindArrow';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const WindItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const displayUnits = useTelemetryValue('DisplayUnits'); // 0 = imperial, 1 = metric
    const { windDirection, windVelocity, windYaw } = useThrottledWeather();
    const relativeWindDirection = (windDirection ?? 0) - (windYaw ?? 0);

    const isMetric = displayUnits === 1;
    const speedPosition = settings?.wind?.speedPosition ?? 'right';
    const speed =
      windVelocity !== undefined
        ? Math.round(windVelocity * (isMetric ? 3.6 : 2.23694))
        : '-';
    const speedEl = <span>{speed}</span>;
    const arrowEl = (
      <WindArrow direction={relativeWindDirection} className="mx-1 w-3.5 h-4" />
    );

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center gap-1 items-center">
          {speedPosition === 'left' && speedEl}
          {arrowEl}
          {speedPosition === 'right' && speedEl}
        </div>
      </div>
    );
  }
);
WindItem.displayName = 'WindItem';
