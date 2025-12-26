import carLogoImage from '../../../../assets/img/car_manufacturer.png';
import { CAR_ID_TO_CAR_MANUFACTURER } from './carManufacturerMapping';
import { CAR_MANUFACTURER_SPRITE_POSITIONS, SPRITES_PER_ROW, SPRITES_PER_COLUMN } from './spritePositions';

interface CarManufacturerProps {
  carId: number;
  className?: string;
}

export const CarManufacturer = ({
  carId,
}: CarManufacturerProps) => {
  const carData = CAR_ID_TO_CAR_MANUFACTURER[carId];
  const carManufacturer = carData?.manufacturer || 'unknown';

  if (carId < 0 || !Object.keys(CAR_MANUFACTURER_SPRITE_POSITIONS).includes(carManufacturer)) {
    return null;
  }

  const position = CAR_MANUFACTURER_SPRITE_POSITIONS[carManufacturer];
  const backgroundSize = `${SPRITES_PER_ROW}em ${SPRITES_PER_COLUMN}em`;
  const backgroundPosition = `${-position.x}em ${-position.y}em`;

  return (
    <span
      className="inline-block w-[1em] h-[1em] bg-no-repeat"
      style={{
        backgroundImage: `url(${carLogoImage})`,
        backgroundSize,
        backgroundPosition,
        imageRendering: 'auto',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
      }}
    />
  );
};
