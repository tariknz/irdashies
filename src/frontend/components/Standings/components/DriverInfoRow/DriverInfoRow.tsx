import { memo, useMemo } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import { CountryFlag } from '../CountryFlag/CountryFlag';
import type { LastTimeState } from '../../createStandings';
import { Compound } from '../Compound/Compound';
import { CarManufacturer } from '../CarManufacturer/CarManufacturer';
import { useDashboard } from '@irdashies/context';
import type { RelativeWidgetSettings, StandingsWidgetSettings } from '../../../Settings/types';

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
  iRating?: number;
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
  displayOrder?: string[];
  config?: RelativeWidgetSettings['config'] | StandingsWidgetSettings['config'];
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
  iRating,
  iratingChange,
  hidden,
  flairId,
  tireCompound,
  carId,
  lapTimeDeltas,
  numLapDeltasToShow,
  isMultiClass,
  displayOrder,
  config
}: DriverRowInfoProps) => {
  // Memoize formatted time strings to avoid recalculation on every render
  const lastTimeString = useMemo(() => formatTime(lastTime), [lastTime]);
  const fastestTimeString = useMemo(() => formatTime(fastestTime), [fastestTime]);

  const { currentDashboard } = useDashboard();
  const settings = currentDashboard?.generalSettings;
  const highlightColor = settings?.highlightColor ?? 960745;

  // Define column configurations
  const columnDefinitions = useMemo(() => {
    const getLastTimeColorClass = (state?: LastTimeState): string => {
      if (state === 'session-fastest') return 'text-purple-400';
      if (state === 'personal-best') return 'text-green-400';
      return '';
    };

    const columns = [
      {
        id: 'position',
        shouldRender: (displayOrder ? displayOrder.includes('position') : true) && (config?.position ?? true),
        render: () => (
          <td
            key="position"
            data-column="position"
            className={`text-center text-white px-2 whitespace-nowrap ${isPlayer ? `${getTailwindStyle(classColor, highlightColor, isMultiClass).classHeader}` : ''}`}
          >
            {hidden ? '' : position}
          </td>
        ),
      },
      {
        id: 'carNumber',
        shouldRender: (displayOrder ? displayOrder.includes('carNumber') : true) && (config?.carNumber?.enabled ?? true),
        render: () => (
          <td
            key="carNumber"
            data-column="carNumber"
            className={[
              getTailwindStyle(classColor, highlightColor, isMultiClass).driverIcon,
              'border-l-4',
              'text-white text-right px-1 whitespace-nowrap',
            ].join(' ')}
          >
            {hidden ? '' : `#${carNumber}`}
          </td>
        ),
      },
      {
        id: 'countryFlags',
        shouldRender: (displayOrder ? displayOrder.includes('countryFlags') : true) && (config?.countryFlags?.enabled ?? true),
        render: () => (
          <td key="countryFlags" data-column="countryFlags" className="px-1 whitespace-nowrap">
            {hidden ? null : (flairId && <CountryFlag
              flairId={flairId}
              size="sm"
            />)}
          </td>
        ),
      },
      {
        id: 'driverName',
        shouldRender: (displayOrder ? displayOrder.includes('driverName') : true) && (config?.driverName?.enabled ?? true),
        render: () => (
          <td
            key="driverName"
            data-column="driverName"
            className="px-2 py-0.5"
            style={{ 
              width: config?.driverName?.width ?? 250,
              maxWidth: config?.driverName?.width ?? 250 
            }}
          >
            <div className="flex items-center overflow-hidden">
              <span
                className={`animate-pulse transition-[width] duration-300 ${radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'}`}
              >
                <SpeakerHighIcon className="mt-px" size={16} />
              </span>
              <div className="flex-1 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
                <span className="truncate">{hidden ? '' : name}</span>
              </div>
            </div>
          </td>
        ),
      },
      {
        id: 'pitStatus',
        shouldRender: (displayOrder ? displayOrder.includes('pitStatus') : true) && (config?.pitStatus ?? true),
        render: () => (
          <td key="pitStatus" data-column="pitStatus" className="px-1 text-center">
            {hidden ? null : (onPitRoad && (
              <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 leading-tight">
                PIT
              </span>
            ))}
          </td>
        ),
      },
      {
        id: 'carManufacturer',
        shouldRender: (displayOrder ? displayOrder.includes('carManufacturer') : true) && (config?.carManufacturer?.enabled ?? true),
        render: () => (
          <td key="carManufacturer" data-column="carManufacturer" className="whitespace-nowrap">
            <div className="flex items-center justify-center pr-2 text-center">
              {hidden ? null : (carId && <CarManufacturer
                carId={carId}
                size="sm"
              />)}
            </div>
          </td>
        ),
      },
      {
        id: 'badge',
        shouldRender: (displayOrder ? displayOrder.includes('badge') : true) && (config?.badge?.enabled ?? true),
        render: () => <td key="badge" data-column="badge" className="whitespace-nowrap text-center">{hidden ? null : badge}</td>,
      },
      {
        id: 'iRating',
        shouldRender: (displayOrder ? displayOrder.includes('iRating') : true) && (config?.iRating?.enabled ?? false),
        render: () => <td key="iRating" data-column="iRating" className="px-2 text-center whitespace-nowrap">{hidden ? null : iRating}</td>,
      },
      {
        id: 'iratingChange',
        shouldRender: (displayOrder ? displayOrder.includes('iratingChange') : true) && (config?.iratingChange?.enabled ?? false),
        render: () => <td key="iratingChange" data-column="iratingChange" className="px-2 text-center whitespace-nowrap">{hidden ? null : iratingChange}</td>,
      },
      {
        id: 'delta',
        shouldRender: (displayOrder ? displayOrder.includes('delta') : true) && (config?.delta?.enabled ?? false),
        render: () => <td key="delta" data-column="delta" className="px-2 whitespace-nowrap text-center">{hidden ? '' : delta?.toFixed(1)}</td>,
      },
      {
        id: 'fastestTime',
        shouldRender: (displayOrder ? displayOrder.includes('fastestTime') : true) && (config?.fastestTime?.enabled ?? false),
        render: () => (
          <td key="fastestTime" data-column="fastestTime" className={`px-2 w-20 whitespace-nowrap ${hasFastestTime ? 'text-purple-400' : ''}`}>
            {hidden ? '' : fastestTimeString}
          </td>
        ),
      },
      {
        id: 'lastTime',
        shouldRender: (displayOrder ? displayOrder.includes('lastTime') : true) && (config?.lastTime?.enabled ?? false),
        render: () => (
          <td key="lastTime" data-column="lastTime" className={`px-2 w-20 whitespace-nowrap ${getLastTimeColorClass(lastTimeState)}`}>
            {hidden ? '' : lastTimeString}
          </td>
        ),
      },
      {
        id: 'compound',
        shouldRender: (displayOrder ? displayOrder.includes('compound') : true) && (config?.compound?.enabled ?? false),
        render: () => (
          <td key="compound" data-column="compound" className="whitespace-nowrap text-center">
            <div className="flex items-center justify-center pr-1">
              {hidden ? null : (tireCompound !== undefined && carId && <Compound tireCompound={tireCompound} carId={carId} size="sm" />)}
            </div>
          </td>
        ),
      },
      {
        id: 'lapTimeDeltas',
        shouldRender: (displayOrder ? displayOrder.includes('lapTimeDeltas') : true) && (config?.lapTimeDeltas?.enabled ?? false),
        render: () => (
          <>
            {lapTimeDeltas !== undefined && (
              lapTimeDeltas.map((deltaValue, index) => (
                <td
                  key={`lapTimeDelta-${index}`}
                  data-column="lapTimeDelta"
                  className={[
                    'px-1 text-center whitespace-nowrap',
                    deltaValue > 0 ? 'text-green-400' : 'text-red-400'
                  ].join(' ')}
                >
                  {hidden ? '' : (deltaValue > 0 ? '+' : '') + deltaValue.toFixed(1)}
                </td>
              ))
            )}
            {lapTimeDeltas === undefined && isPlayer && numLapDeltasToShow && (
              [...Array(numLapDeltasToShow)].map((_, index) => (
                <td key={`empty-lapTimeDelta-${index}`} data-column="lapTimeDelta" className="px-1 text-center whitespace-nowrap">{hidden ? '' : '-'}</td>
              ))
            )}
            {lapTimeDeltas === undefined && (!isPlayer || !numLapDeltasToShow) && numLapDeltasToShow && (
              [...Array(numLapDeltasToShow)].map((_, index) => (
                <td key={`placeholder-lapTimeDelta-${index}`} data-column="lapTimeDelta" className="px-1 text-center whitespace-nowrap">{hidden ? '' : ''}</td>
              ))
            )}
          </>
        ),
      },
    ];

    // Sort columns based on displayOrder, but only include columns that should render
    if (displayOrder) {
      const orderedColumns = displayOrder
        .map(orderId => columns.find(col => col.id === orderId))
        .filter((col): col is NonNullable<typeof col> => col !== undefined && col.shouldRender);

      // Add any columns that should render but aren't in displayOrder (for backwards compatibility)
      const remainingColumns = columns.filter(col =>
        col.shouldRender && !displayOrder.includes(col.id)
      );

      return [...orderedColumns, ...remainingColumns];
    }

    // If no displayOrder, return all columns that should render in original order
    return columns.filter(col => col.shouldRender);
  }, [
    carNumber, flairId, carId, badge, iRating, iratingChange, delta,
    tireCompound, lapTimeDeltas, numLapDeltasToShow, isPlayer, displayOrder, config,
    classColor, highlightColor, isMultiClass, hasFastestTime, lastTimeState,
    fastestTimeString, lastTimeString, name, onPitRoad, position, radioActive, hidden
  ]);

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
      {columnDefinitions.map(column => column.render())}
    </tr>
  );
});

DriverInfoRow.displayName = 'DriverInfoRow';
