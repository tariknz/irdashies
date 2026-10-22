import { memo } from 'react';
import { LMU_CAR_ID_BASE } from '@irdashies/types';
import carLogoImage from '../../../assets/img/car_manufacturer.png';
import lmuCarLogoImage from '../../../assets/img/lmu_car_manufacturer.png';
import { CAR_ID_TO_CAR_MANUFACTURER } from './carManufacturerMapping';
import {
  CAR_MANUFACTURER_SPRITE_POSITIONS,
  SPRITES_PER_ROW,
  SPRITES_PER_COLUMN,
} from './carManufacturerSpritePositions';
import {
  LMU_MANUFACTURER_SPRITE_POSITIONS,
  LMU_SPRITES_PER_ROW,
  LMU_SPRITES_PER_COLUMN,
} from './lmuManufacturerSpritePositions';

interface CarManufacturerProps {
  carId: number;
  className?: string;
}

/**
 * One manufacturer badge, from whichever simulator's sheet the car belongs to.
 *
 * Two sheets, because the two games share only some marques: LMU runs Oreca,
 * Duqueine, Ginetta, Glickenhaus, Vanwall and Isotta Fraschini, none of which
 * iRacing has. Keeping them apart means either can be regenerated without
 * touching the other.
 *
 * Which sheet is decided by the car id rather than by a prop. LMU's ids are
 * synthesised at or above LMU_CAR_ID_BASE and iRacing's are real and far
 * below, so the data already says which game a car came from and nothing has
 * to be threaded down to the row.
 */
export const CarManufacturer = memo(({ carId }: CarManufacturerProps) => {
  const carData = CAR_ID_TO_CAR_MANUFACTURER[carId];
  const carManufacturer = carData?.manufacturer || 'unknown';
  const isLmu = carId >= LMU_CAR_ID_BASE;

  const positions = isLmu
    ? LMU_MANUFACTURER_SPRITE_POSITIONS
    : CAR_MANUFACTURER_SPRITE_POSITIONS;

  // 0 is not a car, it is the absence of one: resolveLmuCarId returns it when
  // no marque matches the vehicle name, and iRacing's own ids start at 1.
  // Letting it through drew the iRacing sheet's `unknown` cell -- `isLmu` is
  // false at 0, so an LMU car with an unrecognised marque got a logo from the
  // wrong game entirely.
  if (carId <= 0 || !(carManufacturer in positions)) {
    return null;
  }

  const position = positions[carManufacturer];
  const perRow = isLmu ? LMU_SPRITES_PER_ROW : SPRITES_PER_ROW;
  const perColumn = isLmu ? LMU_SPRITES_PER_COLUMN : SPRITES_PER_COLUMN;
  const spriteSizeEm = 1;
  const backgroundSize = `${perRow * spriteSizeEm}em ${perColumn * spriteSizeEm}em`;
  const backgroundPosition = `${-position.x * spriteSizeEm}em ${-position.y * spriteSizeEm}em`;

  return (
    <span
      className="inline-block w-[1em] h-[1em] bg-no-repeat"
      style={{
        backgroundImage: `url(${isLmu ? lmuCarLogoImage : carLogoImage})`,
        backgroundSize,
        backgroundPosition,
        transform: 'scale(1.25) translateZ(0)',
      }}
    />
  );
});

CarManufacturer.displayName = 'CarManufacturer';
