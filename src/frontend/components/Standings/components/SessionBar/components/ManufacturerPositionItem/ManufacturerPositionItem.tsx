import { memo } from 'react';
import {
  useDriverCarIdx,
  useSessionDrivers,
  useTelemetryValues,
} from '@irdashies/context';
import { CarManufacturer } from '../../../CarManufacturer/CarManufacturer';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../../../CarManufacturer/carManufacturerMapping';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const ManufacturerPositionItem = memo(
  ({ settings, standalone }: SessionBarItemProps) => {
    const drivers = useSessionDrivers();
    const playerCarIdx = useDriverCarIdx();
    const carIdxPositions = useTelemetryValues('CarIdxPosition');

    if (playerCarIdx === undefined || !drivers) return null;
    // Pace cars/spectators aren't classified competitors — exclude them so
    // manufacturer counts match what the standings list actually shows.
    const classifiedDrivers = drivers.filter(
      (d) => !d.CarIsPaceCar && !d.IsSpectator
    );
    const playerDriver = classifiedDrivers.find(
      (d) => d.CarIdx === playerCarIdx
    );
    if (!playerDriver?.CarID) return null;
    const playerMfr =
      CAR_ID_TO_CAR_MANUFACTURER[playerDriver.CarID]?.manufacturer;
    if (!playerMfr || playerMfr === 'unknown') return null;
    const mfrSettings = settings?.manufacturerPosition;
    if (mfrSettings?.hideIfSingleMake) {
      const allMfrs = new Set(
        classifiedDrivers.map(
          (d) => CAR_ID_TO_CAR_MANUFACTURER[d.CarID]?.manufacturer ?? 'unknown'
        )
      );
      if (allMfrs.size <= 1) return null;
    }
    const sameMfr = classifiedDrivers.filter(
      (d) => CAR_ID_TO_CAR_MANUFACTURER[d.CarID]?.manufacturer === playerMfr
    );
    const total = sameMfr.length;
    if (mfrSettings?.hideIfSingleDriver && total <= 1) return null;
    const sorted = sameMfr
      .map((d) => ({
        carIdx: d.CarIdx,
        pos: carIdxPositions?.[d.CarIdx] ?? 0,
      }))
      .filter((d) => d.pos > 0)
      .sort((a, b) => a.pos - b.pos);
    const rank = sorted.findIndex((d) => d.carIdx === playerCarIdx) + 1;
    if (rank === 0) return null;

    return (
      <div className={sessionBarItemWrapperClass(standalone)}>
        <div className="flex justify-center gap-1 items-center tabular-nums">
          <CarManufacturer carId={playerDriver.CarID} />
          <span>
            {rank}/{total}
          </span>
        </div>
      </div>
    );
  }
);
ManufacturerPositionItem.displayName = 'ManufacturerPositionItem';
