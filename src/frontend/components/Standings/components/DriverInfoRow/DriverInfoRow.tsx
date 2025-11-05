import {
  SpeakerHighIcon,
} from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import { CountryFlag } from '../CountryFlag/CountryFlag';
import { Compound } from '../Compound/Compound';

interface DriverRowInfoProps {
  carIdx: number;
  classColor: number;
  carNumber?: string;
  name: string;
  isPlayer: boolean;
  hasFastestTime: boolean;
  delta?: number;
  position?: number;
  badge?: React.ReactNode;
  iratingChange?: React.ReactNode;
  lastTime?: number;
  fastestTime?: number;
  onPitRoad?: boolean;
  onTrack?: boolean;
  radioActive?: boolean;
  isLapped?: boolean;
  isLappingAhead?: boolean;
  hidden?: boolean;
  flairId?: number;
  tireCompound?: number;
}

export const DriverInfoRow = ({
  carIdx,
  carNumber,
  classColor,
  name,
  isPlayer,
  hasFastestTime,
  delta,
  position,
  badge,
  lastTime,
  fastestTime,
  onPitRoad,
  onTrack,
  radioActive,
  isLapped,
  isLappingAhead,
  iratingChange,
  hidden,
  flairId,
  tireCompound
}: DriverRowInfoProps) => {
  // convert seconds to mm:ss:ms
  const lastTimeString = formatTime(lastTime);
  const fastestTimeString = formatTime(fastestTime);

  return (
    <tr
      key={carIdx}
      className={[
        `odd:bg-slate-800/70 even:bg-slate-900/70 text-sm`,
        !onTrack || onPitRoad ? 'text-white/60' : '',
        isPlayer ? 'text-amber-300' : '',
        !isPlayer && isLapped ? 'text-blue-400' : '',
        !isPlayer && isLappingAhead ? 'text-red-400' : '',
        hidden ? 'invisible' : '',
      ].join(' ')}
    >
      <td
        className={`text-center text-white px-2 ${isPlayer ? `${getTailwindStyle(classColor).classHeader}` : ''}`}
      >
        {position}
      </td>
      <td 
        className={[
          getTailwindStyle(classColor).driverIcon,
          'border-l-4',
          carNumber ? 'text-white text-right px-1 w-10' : 'w-0'
        ].join(' ')}
      >
        {carNumber && `#${carNumber}`}
      </td>
      <td
        className="px-2 py-0.5 w-full max-w-0 overflow-hidden"
      >
        <div className="flex justify-between align-center items-center">
          <div className="flex-1 flex items-center overflow-hidden">
            {flairId && <CountryFlag flairId={flairId} size="sm" className="mr-2 flex-shrink-0" />}
            <span
              className={`animate-pulse transition-[width] duration-300 ${radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'}`}
            >
              <SpeakerHighIcon className="mt-[1px]" size={16} />
            </span>
            <div className="flex-1 overflow-hidden [mask-image:linear-gradient(90deg,#000_90%,transparent)]">
              <span className="truncate">{name}</span>
            </div>
          </div>
          {onPitRoad && (
            <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 m-0 leading-tight">
              PIT
            </span>
          )}
        </div>
      </td>
      {badge && <td>{badge}</td>}
      {iratingChange && (
        <td className="px-2 text-left">
          {iratingChange}
        </td>
      )}
      {delta !== undefined && (
        <td className="px-2">{delta.toFixed(1)}</td>
      )}
      {fastestTime !== undefined && (
        <td className={`px-2 ${hasFastestTime ? 'text-purple-400' : ''}`}>
          {fastestTimeString}
        </td>
      )}
      {lastTime !== undefined && (
        <td
          className={`px-2 ${
            lastTimeString === fastestTimeString
              ? hasFastestTime
                ? 'text-purple-400'
                : 'text-green-400'
              : ''
          }`}
        >
          {lastTimeString}
        </td>
      )}
     {tireCompound !== undefined && (
        <td className="px-2">
           <Compound tireCompound={tireCompound} carId={carId} size="sm" className="mr-2 flex-shrink-0" />
        </td>
     )}
    </tr>
  );
};
