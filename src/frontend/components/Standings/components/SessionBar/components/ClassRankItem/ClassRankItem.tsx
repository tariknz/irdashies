import { memo } from 'react';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useTelemetryValues,
} from '@irdashies/context';
import { RacingHelmetIcon } from '../../../../../shared/RacingHelmetIcon';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const ClassRankItem = memo(({ standalone }: SessionBarItemProps) => {
  const drivers = useSessionDrivers();
  const playerCarIdx = useDriverCarIdx();
  const carIdxClassPositions = useTelemetryValues('CarIdxClassPosition');

  if (playerCarIdx === undefined || !drivers) return null;
  // Pace cars/spectators aren't classified competitors — exclude them so the
  // class total matches what the standings list actually shows.
  const classifiedDrivers = drivers.filter(
    (d) => !d.CarIsPaceCar && !d.IsSpectator
  );
  const playerDriver = classifiedDrivers.find((d) => d.CarIdx === playerCarIdx);
  if (!playerDriver?.CarClassID) return null;
  const total = classifiedDrivers.filter(
    (d) => d.CarClassID === playerDriver.CarClassID
  ).length;
  const rank = carIdxClassPositions?.[playerCarIdx] ?? 0;
  if (rank <= 0) return null;

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-center gap-1 items-center tabular-nums">
        <RacingHelmetIcon size={14} />
        <span>
          {rank}/{total}
        </span>
      </div>
    </div>
  );
});
ClassRankItem.displayName = 'ClassRankItem';
