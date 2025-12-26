import carLogoImage from '../../../../assets/img/car_manufacturer.png';
import { CAR_ID_TO_CAR_MANUFACTURER } from './carManufacturerMapping';

interface CarManufacturerProps {
  carId: number;
  className?: string;
}

const carLogoPositions: Record<string, { x: string; y: string }> = {
  unknown: { x: '0', y: '0' },
  porsche: { x: '0', y: '2.55%' },
  ferrari: { x: '0', y: '5.13%' },
  bmw: { x: '0', y: '7.66%' },
  audi: { x: '0', y: '10.34%' },
  ford: { x: '0', y: '12.81%' },
  acura: { x: '0', y: '15.38%' },
  mclaren: { x: '0', y: '17.95%' },
  chevrolet: { x: '0', y: '20.55%' },
  aston: { x: '0', y: '22.9%' },
  lamborghini: { x: '0', y: '25.67%' },
  honda: { x: '0', y: '28.22%' },
  cadillac: { x: '0', y: '30.77%' },
  skipbarber: { x: '0', y: '33.32%' },
  pontiac: { x: '0', y: '35.8%' },
  radical: { x: '0', y: '38.5%' },
  riley: { x: '0', y: '41.2%' },
  scca: { x: '0', y: '43.5%' },
  lotus: { x: '0', y: '46.17%' },
  vw: { x: '0', y: '48.72%' },
  williams: { x: '0', y: '51.27%' },
  mazda: { x: '0', y: '53.85%' },
  kia: { x: '0', y: '56.37%' },
  ruf: { x: '0', y: '58.92%' },
  toyota: { x: '0', y: '61.50%' },
  holden: { x: '0', y: '64.12%' },
  nissan: { x: '0', y: '66.67%' },
  subaru: { x: '0', y: '69.22%' },
  hyundai: { x: '0', y: '71.77%' },
  ligier: { x: '0', y: '74.32%' },
  renault: { x: '0', y: '76.94%' },
  superformula: { x: '0', y: '79.51%' },
  dallara: { x: '0', y: '82.0%' },
  mercedes: { x: '0', y: '84.60%' },
  srx: { x: '0', y: '87.17%' },
  buick: { x: '0', y: '89.78%' },
  hpd: { x: '0', y: '92.4%' },
};

export const CarManufacturer = ({
  carId,
}: CarManufacturerProps) => {
  const carData = CAR_ID_TO_CAR_MANUFACTURER[carId];
  const carManufacturer = carData?.manufacturer || 'unknown';

  if (carId < 0 || !Object.keys(carLogoPositions).includes(carManufacturer)) {
    return null;
  }

  return (
    <span
      className={`inline-block w-[1em] h-[1em] bg-no-repeat bg-size-[100%_auto]`}
      style={{
        backgroundImage: `url(${carLogoImage})`,
        backgroundPosition: `${carLogoPositions[carManufacturer].x} ${carLogoPositions[carManufacturer].y}`,
        imageRendering: 'auto',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
      }}
    />
  );
};
