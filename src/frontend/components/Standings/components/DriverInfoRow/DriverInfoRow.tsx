import { memo, useMemo, useCallback, Fragment } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import { CountryFlag } from '../CountryFlag/CountryFlag';
import type { LastTimeState } from '../../createStandings';
import { Compound } from '../Compound/Compound';
import { CarManufacturer } from '../CarManufacturer/CarManufacturer';
import { useDashboard } from '@irdashies/context';
import type { RelativeWidgetSettings, StandingsWidgetSettings } from '../../../Settings/types';

const getLastTimeColorClass = (state?: LastTimeState): string => {
  if (state === 'session-fastest') return 'text-purple-400';
  if (state === 'personal-best') return 'text-green-400';
  return '';
};

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
  const highlightColor = useMemo(() => {
    return currentDashboard?.generalSettings?.highlightColor ?? 960745;
  }, [currentDashboard?.generalSettings?.highlightColor]);

  // Memoize tailwind styles to avoid recalculating on every render
  const tailwindStyles = useMemo(() => {
    return getTailwindStyle(classColor, highlightColor, isMultiClass);
  }, [classColor, highlightColor, isMultiClass]);

  // Memoize placeholder arrays for lapTimeDeltas
  const emptyLapDeltaPlaceholders = useMemo(() => {
    if (!numLapDeltasToShow) return null;
    return Array.from({ length: numLapDeltasToShow }, (_, index) => index);
  }, [numLapDeltasToShow]);

  // Memoize column render functions using useCallback where possible
  const renderPosition = useCallback(() => (
    <td
      key="position"
      data-column="position"
      className={`w-auto text-center text-white px-2 whitespace-nowrap ${isPlayer ? tailwindStyles.classHeader : ''}`}
    >
      {hidden ? '' : position}
    </td>
  ), [isPlayer, tailwindStyles.classHeader, hidden, position]);

  const renderCarNumber = useCallback(() => (
    <td
      key="carNumber"
      data-column="carNumber"
      className={`w-auto ${tailwindStyles.driverIcon} border-l-4 text-white text-right px-1 whitespace-nowrap`}
    >
      {hidden ? '' : `#${carNumber}`}
    </td>
  ), [tailwindStyles.driverIcon, hidden, carNumber]);

  const renderCountryFlags = useCallback(() => (
    <td key="countryFlags" data-column="countryFlags" className="w-auto pl-2 whitespace-nowrap">
      {hidden ? null : (flairId && <CountryFlag flairId={flairId} size="sm" />)}
    </td>
  ), [hidden, flairId]);

  const renderDriverName = useCallback(() => (
    <td
      key="driverName"
      data-column="driverName"
      className="w-full max-w-0 px-2 py-0.5"
    >
      <div className="flex items-center overflow-hidden">
        <span
          className={`animate-pulse transition-[width] duration-300 ${radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'}`}
        >
          <SpeakerHighIcon className="mt-px" size={16} />
        </span>
        <div className="flex-1 min-w-0 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
          <span className="block truncate">{hidden ? '' : name}</span>
        </div>
      </div>
    </td>
  ), [radioActive, hidden, name]);

  const renderPitStatus = useCallback(() => (
    <td key="pitStatus" data-column="pitStatus" className="w-auto px-1 text-center">
      {hidden ? null : (onPitRoad && (
        <span className="text-white animate-pulse text-xs border-yellow-500 border-2 rounded-md text-center text-nowrap px-2 leading-tight">
          PIT
        </span>
      ))}
    </td>
  ), [hidden, onPitRoad]);

  const renderCarManufacturer = useCallback(() => (
    <td key="carManufacturer" data-column="carManufacturer" className="w-auto whitespace-nowrap">
      <div className="flex items-center justify-center pr-2 text-center">
        {hidden ? null : (carId && <CarManufacturer carId={carId} size="sm" />)}
      </div>
    </td>
  ), [hidden, carId]);

  const renderBadge = useCallback(() => (
    <td key="badge" data-column="badge" className="w-auto whitespace-nowrap text-center">{hidden ? null : badge}</td>
  ), [hidden, badge]);

  const renderIratingChange = useCallback(() => (
    <td key="iratingChange" data-column="iratingChange" className="w-auto px-2 text-center whitespace-nowrap">{hidden ? null : iratingChange}</td>
  ), [hidden, iratingChange]);

  const renderDelta = useCallback(() => (
    <td key="delta" data-column="delta" className="w-auto px-2 whitespace-nowrap text-center">{hidden ? '' : delta?.toFixed(1)}</td>
  ), [hidden, delta]);

  const renderFastestTime = useCallback(() => (
    <td key="fastestTime" data-column="fastestTime" className={`w-auto px-2 whitespace-nowrap ${hasFastestTime ? 'text-purple-400' : ''}`}>
      {hidden ? '' : fastestTimeString}
    </td>
  ), [hasFastestTime, hidden, fastestTimeString]);

  const renderLastTime = useCallback(() => (
    <td key="lastTime" data-column="lastTime" className={`w-auto px-2 whitespace-nowrap ${getLastTimeColorClass(lastTimeState)}`}>
      {hidden ? '' : lastTimeString}
    </td>
  ), [lastTimeState, hidden, lastTimeString]);

  const renderCompound = useCallback(() => (
    <td key="compound" data-column="compound" className="w-auto whitespace-nowrap text-center">
      <div className="flex items-center justify-center pr-1">
        {hidden ? null : (tireCompound !== undefined && carId && <Compound tireCompound={tireCompound} carId={carId} size="sm" />)}
      </div>
    </td>
  ), [hidden, tireCompound, carId]);

  const renderLapTimeDeltas = useCallback(() => {
    if (lapTimeDeltas !== undefined) {
      return (
        <Fragment>
          {lapTimeDeltas.map((deltaValue, index) => (
            <td
              key={`lapTimeDelta-${index}`}
              data-column="lapTimeDelta"
              className={`w-auto px-1 text-center whitespace-nowrap ${deltaValue > 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {hidden ? '' : (deltaValue > 0 ? '+' : '') + deltaValue.toFixed(1)}
            </td>
          ))}
        </Fragment>
      );
    }
    
    if (emptyLapDeltaPlaceholders) {
      if (isPlayer) {
        return (
          <Fragment>
            {emptyLapDeltaPlaceholders.map((index) => (
              <td key={`empty-lapTimeDelta-${index}`} data-column="lapTimeDelta" className="w-auto px-1 text-center whitespace-nowrap">{hidden ? '' : '-'}</td>
            ))}
          </Fragment>
        );
      }
      return (
        <Fragment>
          {emptyLapDeltaPlaceholders.map((index) => (
            <td key={`placeholder-lapTimeDelta-${index}`} data-column="lapTimeDelta" className="w-auto px-1 text-center whitespace-nowrap">{hidden ? '' : ''}</td>
          ))}
        </Fragment>
      );
    }
    
    return null;
  }, [lapTimeDeltas, emptyLapDeltaPlaceholders, isPlayer, hidden]);

  // Define column configurations
  const columnDefinitions = useMemo(() => {
    const columns = [
      {
        id: 'position',
        shouldRender: (displayOrder ? displayOrder.includes('position') : true) && (config?.position ?? true),
        render: renderPosition,
      },
      {
        id: 'carNumber',
        shouldRender: (displayOrder ? displayOrder.includes('carNumber') : true) && (config?.carNumber?.enabled ?? true),
        render: renderCarNumber,
      },
      {
        id: 'countryFlags',
        shouldRender: (displayOrder ? displayOrder.includes('countryFlags') : true) && (config?.countryFlags?.enabled ?? true),
        render: renderCountryFlags,
      },
      {
        id: 'driverName',
        shouldRender: (displayOrder ? displayOrder.includes('driverName') : true) && (config?.driverName?.enabled ?? true),
        render: renderDriverName,
      },
      {
        id: 'pitStatus',
        shouldRender: (displayOrder ? displayOrder.includes('pitStatus') : true) && (config?.pitStatus ?? true),
        render: renderPitStatus,
      },
      {
        id: 'carManufacturer',
        shouldRender: (displayOrder ? displayOrder.includes('carManufacturer') : true) && (config?.carManufacturer?.enabled ?? true),
        render: renderCarManufacturer,
      },
      {
        id: 'badge',
        shouldRender: (displayOrder ? displayOrder.includes('badge') : true) && (config?.badge?.enabled ?? true),
        render: renderBadge,
      },
      {
        id: 'iratingChange',
        shouldRender: (displayOrder ? displayOrder.includes('iratingChange') : true) && (config?.iratingChange?.enabled ?? false),
        render: renderIratingChange,
      },
      {
        id: 'delta',
        shouldRender: (displayOrder ? displayOrder.includes('delta') : true) && (config?.delta?.enabled ?? false),
        render: renderDelta,
      },
      {
        id: 'fastestTime',
        shouldRender: (displayOrder ? displayOrder.includes('fastestTime') : true) && (config?.fastestTime?.enabled ?? false),
        render: renderFastestTime,
      },
      {
        id: 'lastTime',
        shouldRender: (displayOrder ? displayOrder.includes('lastTime') : true) && (config?.lastTime?.enabled ?? false),
        render: renderLastTime,
      },
      {
        id: 'compound',
        shouldRender: (displayOrder ? displayOrder.includes('compound') : true) && (config?.compound?.enabled ?? false),
        render: renderCompound,
      },
      {
        id: 'lapTimeDeltas',
        shouldRender: (displayOrder ? displayOrder.includes('lapTimeDeltas') : false) && (config && 'lapTimeDeltas' in config ? config.lapTimeDeltas.enabled : false),
        render: renderLapTimeDeltas,
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
    displayOrder,
    config,
    renderPosition,
    renderCarNumber,
    renderCountryFlags,
    renderDriverName,
    renderPitStatus,
    renderCarManufacturer,
    renderBadge,
    renderIratingChange,
    renderDelta,
    renderFastestTime,
    renderLastTime,
    renderCompound,
    renderLapTimeDeltas,
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
