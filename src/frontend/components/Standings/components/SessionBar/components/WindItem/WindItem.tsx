import { memo } from 'react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { resolveSpeedUnit, speedFromMs } from '@irdashies/utils/units';
import { WindArrow } from '../../../../../shared/WindArrow';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const WindItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const { displayUnits, windDirection, windVelocity, windYaw } =
      useSessionBarSnapshot() ?? { displayUnits: 0 };
    const relativeWindDirection = (windDirection ?? 0) - (windYaw ?? 0);

    const speedUnit = resolveSpeedUnit('auto', displayUnits);
    const speedPosition = settings?.wind?.speedPosition ?? 'right';
    const speed =
      windVelocity !== undefined
        ? Math.round(speedFromMs(windVelocity, speedUnit))
        : '-';
    const speedEl = <span>{speed}</span>;
    // No arrow without a direction (LMU publishes none): defaulted to 0 it
    // would point at a headwind that is not there.
    const arrowEl = windDirection !== undefined && (
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
