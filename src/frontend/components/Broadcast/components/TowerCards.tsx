import { MicrophoneIcon } from '@phosphor-icons/react';
import {
  sessionBarSelectors,
  useCarIdxSpeed,
  useSessionBarSelector,
} from '@irdashies/context';
import type { Standings } from '@irdashies/domain';
import { formatTime } from '@irdashies/utils/time';
import { CarManufacturer } from '../../shared/CarManufacturer/CarManufacturer';
import { classColor, driverName } from '../format';

const KMH_PER_MPH = 1.609344;

/** Speed arrives in km/h; iRacing's DisplayUnits 0 means imperial. */
export const formatSpeed = (kmh: number, displayUnits?: number | null) =>
  displayUnits === 0
    ? `${Math.round(kmh / KMH_PER_MPH)} mph`
    : `${Math.round(kmh)} km/h`;

export const BattleCard = ({
  standing,
  showGap,
}: {
  standing: Standings;
  showGap: boolean;
}) => (
  <div>
    <div className="flex h-12 items-center justify-center bg-slate-800/(--bg-opacity) text-[2.5rem]">
      {standing.carId !== undefined && (
        <CarManufacturer carId={standing.carId} />
      )}
    </div>
    <div
      className={`flex items-center gap-2 px-2 py-0.5 font-bold italic uppercase text-slate-900 ${classColor(standing.carClass.color)}`}
    >
      <span>{standing.classPosition}.</span>
      <span>{standing.driver.carNum}</span>
      <span className="flex-1 truncate">{driverName(standing, 'surname')}</span>
      {showGap && standing.interval !== undefined && (
        <span className="tabular-nums">-{standing.interval.toFixed(3)}</span>
      )}
    </div>
  </div>
);

/** Lower third for the car on camera; reads speed itself so speed ticks
    re-render only this card, not the tower. */
export const FocusCard = ({ standing }: { standing: Standings }) => {
  const speed = useCarIdxSpeed()[standing.carIdx];
  const displayUnits = useSessionBarSelector(sessionBarSelectors.displayUnits);
  return (
    <div className="overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) text-white">
      <div
        className={`flex items-center justify-between px-2 py-0.5 text-sm font-bold italic uppercase text-slate-900 ${classColor(standing.carClass.color)}`}
      >
        <span>{standing.carClass.name}</span>
        <span>P{standing.classPosition}</span>
      </div>
      <div className="flex items-center gap-3 px-2 py-1">
        <span className="text-2xl font-bold italic text-white/70">
          {standing.driver.carNum}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-lg font-bold italic uppercase">
            {driverName(standing, 'name-surname')}
            {standing.radioActive && <MicrophoneIcon size={16} weight="fill" />}
          </div>
          {standing.driver.teamName && (
            <div className="truncate text-sm text-white/60">
              {standing.driver.teamName}
            </div>
          )}
        </div>
        {standing.carId !== undefined && (
          <span className="text-3xl">
            <CarManufacturer carId={standing.carId} />
          </span>
        )}
      </div>
      <div className="flex gap-4 border-t border-white/10 px-2 py-1 text-sm tabular-nums">
        <span>
          <span className="text-white/50">LAST </span>
          {formatTime(standing.lastTime, 'full') || '-'}
        </span>
        <span>
          <span className="text-white/50">BEST </span>
          {formatTime(standing.fastestTime, 'full') || '-'}
        </span>
        {speed !== undefined && (
          <span className="ml-auto">{formatSpeed(speed, displayUnits)}</span>
        )}
      </div>
    </div>
  );
};
