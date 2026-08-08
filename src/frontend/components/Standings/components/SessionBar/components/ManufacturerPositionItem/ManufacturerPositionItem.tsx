import { memo } from 'react';
import { useSessionBarSnapshot } from '@irdashies/context';
import { CarManufacturer } from '../../../CarManufacturer/CarManufacturer';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../../../CarManufacturer/carManufacturerMapping';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const ManufacturerPositionItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const snapshot = useSessionBarSnapshot();
    const playerCarId = snapshot?.playerCarId;
    if (
      !playerCarId ||
      !snapshot ||
      !snapshot.playerClassified ||
      snapshot.playerOverallPosition <= 0
    )
      return null;
    const playerMfr = CAR_ID_TO_CAR_MANUFACTURER[playerCarId]?.manufacturer;
    if (!playerMfr || playerMfr === 'unknown') return null;
    const mfrSettings = settings?.manufacturerPosition;
    if (mfrSettings?.hideIfSingleMake) {
      const allMfrs = new Set(
        snapshot.competitorCarIds.map(
          (id) => CAR_ID_TO_CAR_MANUFACTURER[id]?.manufacturer ?? 'unknown'
        )
      );
      if (allMfrs.size <= 1) return null;
    }
    const sameMfr = snapshot.competitorCarIds
      .map((carId, index) => ({
        carId,
        pos: snapshot.competitorPositions[index] ?? 0,
      }))
      .filter(
        (d) => CAR_ID_TO_CAR_MANUFACTURER[d.carId]?.manufacturer === playerMfr
      );
    const total = sameMfr.length;
    if (mfrSettings?.hideIfSingleDriver && total <= 1) return null;
    const playerPosition = snapshot.playerOverallPosition;
    const rank =
      sameMfr.filter((d) => d.pos > 0 && d.pos < playerPosition).length + 1;
    if (rank === 0) return null;

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center gap-1 items-center tabular-nums">
          <CarManufacturer carId={playerCarId} />
          <span>
            {rank}/{total}
          </span>
        </div>
      </div>
    );
  }
);
ManufacturerPositionItem.displayName = 'ManufacturerPositionItem';
