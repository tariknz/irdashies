import {
  useBlindSpotSelector,
  useDashboard,
  useDriverCarIdx,
  useSessionVisibility,
} from '@irdashies/context';
import type { BlindSpotSnapshot } from '@irdashies/types';
import { deriveRadarCars, type RadarCar } from './deriveRadarCars';
import { useRadarSettings } from './useRadarSettings';

const DEMO_CARS: RadarCar[] = [
  {
    carIdx: 1,
    lateral: -3,
    longitudinal: -8,
    heading: -0.08,
    sameClass: true,
    opacity: 1,
  },
  {
    carIdx: 2,
    lateral: 4,
    longitudinal: 12,
    heading: 0.12,
    sameClass: false,
    opacity: 0.8,
  },
];

export const Radar = () => {
  const snapshot = useBlindSpotSelector(
    (value: BlindSpotSnapshot) => value,
    { rateHz: 25 }
  );
  const playerCarIdx = useDriverCarIdx();
  const settings = useRadarSettings();
  const { isDemoMode, currentDashboard } = useDashboard();
  const sessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const range = settings?.range ?? 30;
  const cars = isDemoMode
    ? DEMO_CARS
    : deriveRadarCars(snapshot, playerCarIdx, range);
  const hasLmuData = (snapshot?.relativeAvailable?.length ?? 0) > 0;
  const highlight = `#${(currentDashboard?.generalSettings?.highlightColor ?? 960745)
    .toString(16)
    .padStart(6, '0')}`;

  if (!isDemoMode && (!sessionVisible || !hasLmuData)) return <></>;
  if (!isDemoMode && settings?.showOnlyWhenOnTrack && !snapshot?.isOnTrack) {
    return <></>;
  }

  const markerWidth = settings?.markerWidth ?? 2.2;
  const markerLength = settings?.markerLength ?? 4.6;
  const scale = 50 / range;

  return (
    <div
      className="relative w-full h-full overflow-hidden rounded-full border border-slate-500/40"
      style={{
        backgroundColor: `rgb(2 6 23 / ${(settings?.background?.opacity ?? 65) / 100})`,
      }}
      aria-label="LMU radar"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle
          cx="50"
          cy="50"
          r="25"
          fill="none"
          stroke="rgb(100 116 139 / 0.25)"
          strokeWidth="0.5"
        />
        <path
          d="M50 2V98M2 50H98"
          stroke="rgb(148 163 184 / 0.18)"
          strokeWidth="0.4"
          strokeDasharray="2 2"
        />
        <rect
          x={50 - (markerWidth * scale) / 2}
          y={50 - (markerLength * scale) / 2}
          width={markerWidth * scale}
          height={markerLength * scale}
          rx="1"
          fill={highlight}
          stroke="white"
          strokeWidth="0.5"
        />
        {cars.map((car) => (
          <rect
            key={car.carIdx}
            x={50 + car.lateral * scale - (markerWidth * scale) / 2}
            y={50 + car.longitudinal * scale - (markerLength * scale) / 2}
            width={markerWidth * scale}
            height={markerLength * scale}
            rx="1"
            fill={car.sameClass ? 'white' : 'rgb(251 191 36)'}
            stroke="rgb(15 23 42)"
            strokeWidth="0.6"
            opacity={car.opacity}
            transform={
              settings?.showOrientation
                ? `rotate(${(-car.heading * 180) / Math.PI} ${50 + car.lateral * scale} ${50 + car.longitudinal * scale})`
                : undefined
            }
          />
        ))}
      </svg>
    </div>
  );
};
