import { memo, useMemo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import { CountryFlag } from '../CountryFlag/CountryFlag';
import type { LastTimeState } from '../../createStandings';
import { Compound } from '../Compound/Compound';
import { CarManufacturer } from '../CarManufacturer/CarManufacturer';
import { useDashboard } from '@irdashies/context'; 

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
  lastTimeState?: LastTimeState;
  onPitRoad?: boolean;
  onTrack?: boolean;
  radioActive?: boolean;
  isLapped?: boolean;
  isLappingAhead?: boolean;
  hidden?: boolean;
  flairId?: number;
  tireCompound?: number;
  carId?: number;
  lapTimeDeltas?: number[];
  numLapDeltasToShow?: number;
  isMultiClass: boolean;
  showManufacturer?: boolean;
  showCompound?: boolean;
}

export const DriverInfoRow = memo(({
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
  lastTimeState,
  onPitRoad,
  onTrack,
  radioActive,
  isLapped,
  isLappingAhead,
  iratingChange,
  hidden,
  flairId,
  tireCompound,
  carId,
  lapTimeDeltas,
  numLapDeltasToShow,
  isMultiClass,
  showManufacturer = false,
  showCompound = false
}: DriverRowInfoProps) => {
  // Memoize formatted time strings to avoid recalculation on every render
  const lastTimeString = useMemo(() => formatTime(lastTime), [lastTime]);
  const fastestTimeString = useMemo(() => formatTime(fastestTime), [fastestTime]);

  const { currentDashboard } = useDashboard(); 
  const settings = currentDashboard?.generalSettings; 
  const highlightColor = settings?.highlightColor ?? 960745; 

  const getLastTimeColorClass = (state?: LastTimeState): string => {
    if (state === 'session-fastest') return 'text-purple-400';
    if (state === 'personal-best') return 'text-green-400';
    return '';
  };

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
        className={`text-center text-white px-2 ${isPlayer ? `${getTailwindStyle(classColor, highlightColor, isMultiClass).classHeader}` : ''}`}
      >
        {position}
      </td>
      <td
        className={[
          getTailwindStyle(classColor, highlightColor, isMultiClass).driverIcon,
          'border-l-4',
          carNumber ? 'text-white text-right px-1 w-10' : 'w-0',
        ].join(' ')}
      >
        {carNumber && `#${carNumber}`}
      </td>
      <td className="px-2 py-0.5 w-full max-w-0 overflow-hidden">
        <div className="flex justify-between align-center items-center">
          <div className="flex-1 flex items-center overflow-hidden">
            {flairId && (
              <CountryFlag
                flairId={flairId}
                size="sm"
                className="mr-2 shrink-0"
              />
            )}
            <span
              className={`animate-pulse transition-[width] duration-300 ${radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'}`}
            >
              <SpeakerHighIcon className="mt-px" size={16} />
            </span>
            <div className="flex-1 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
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
      {showManufacturer && carId && (
        <td>
          <div className="flex items-center pr-2">
            <CarManufacturer
              carId={carId}
              size="sm"
            />
          </div>
        </td>
      )}
      {badge && <td>{badge}</td>}
      {iratingChange && <td className="px-2 text-left">{iratingChange}</td>}
      {delta !== undefined && <td className="px-2">{delta.toFixed(1)}</td>}
      {fastestTime !== undefined && (
        <td className={`px-2 ${hasFastestTime ? 'text-purple-400' : ''}`}>
          {fastestTimeString}
        </td>
      )}
      {lastTime !== undefined && (
        <td className={`px-2 ${getLastTimeColorClass(lastTimeState)}`}>
          {lastTimeString}
        </td>
      )}
      {showCompound && tireCompound !== undefined && carId && (
        <td>
          <div className="flex items-center pr-1">
            <Compound tireCompound={tireCompound} carId={carId} size="sm" />
          </div>
        </td>
      )}
     {lapTimeDeltas !== undefined && (
       <>
         {lapTimeDeltas.map((deltaValue, index) => (
           <td
             key={index}
             className={[
               'px-1 text-center',
               deltaValue > 0 ? 'text-green-400' : 'text-red-400'
             ].join(' ')}
           >
             {deltaValue > 0 ? '+' : ''}{deltaValue.toFixed(1)}
           </td>
         ))}
       </>
     )}
     {lapTimeDeltas === undefined && isPlayer && numLapDeltasToShow && (
       <>
         {[...Array(numLapDeltasToShow)].map((_, index) => (
           <td key={index} className="px-1 text-center">-</td>
         ))}
       </>
     )}
    </tr>
  );
});

DriverInfoRow.displayName = 'DriverInfoRow';
