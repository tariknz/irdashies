import {
  SpeakerHighIcon,
} from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import { CountryFlag } from '../CountryFlag/CountryFlag';
import type { LastTimeState } from '../../createStandings';
import { Compound } from '../Compound/Compound';
import {
  DEFAULT_RELATIVE_COLUMN_ORDER,
  DEFAULT_STANDINGS_COLUMN_ORDER,
  type ColumnId,
} from '../../types/columns';

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
  columnOrder?: string[];
  isStandings?: boolean;
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
  columnOrder,
  isStandings = false,
}: DriverRowInfoProps) => {
  const lastTimeString = formatTime(lastTime);
  const fastestTimeString = formatTime(fastestTime);

  const getLastTimeColorClass = (state?: LastTimeState): string => {
    if (state === 'session-fastest') return 'text-purple-400';
    if (state === 'personal-best') return 'text-green-400';
    return '';
  };

  const defaultOrder = isStandings
    ? DEFAULT_STANDINGS_COLUMN_ORDER
    : DEFAULT_RELATIVE_COLUMN_ORDER;
  
  // Ensure always-visible columns (position, name) are always included
  const alwaysVisibleColumns: ColumnId[] = ['position', 'name'];
  let order: ColumnId[];
  
  if (columnOrder && Array.isArray(columnOrder) && columnOrder.length > 0) {
    const userOrder = columnOrder as ColumnId[];
    
    // Start with user's order, filtering out invalid columns
    const validOrder = userOrder.filter(col => 
      defaultOrder.includes(col as ColumnId)
    );
    
    // Ensure always-visible columns are present, preserving user's order where possible
    const mergedOrder: ColumnId[] = [];
    const addedAlwaysVisible = new Set<ColumnId>();
    
    // First, add always-visible columns at their positions in user's order
    for (const col of validOrder) {
      if (alwaysVisibleColumns.includes(col as ColumnId)) {
        mergedOrder.push(col as ColumnId);
        addedAlwaysVisible.add(col as ColumnId);
      }
    }
    
    // Add other columns from user's order
    for (const col of validOrder) {
      if (!alwaysVisibleColumns.includes(col as ColumnId)) {
        mergedOrder.push(col as ColumnId);
      }
    }
    
    // Add any missing always-visible columns at their default positions
    for (const alwaysCol of alwaysVisibleColumns) {
      if (!addedAlwaysVisible.has(alwaysCol)) {
        const defaultIndex = defaultOrder.indexOf(alwaysCol);
        // Insert at default position, or at the beginning if not found
        const insertIndex = defaultIndex >= 0 && defaultIndex < mergedOrder.length 
          ? defaultIndex 
          : 0;
        mergedOrder.splice(insertIndex, 0, alwaysCol);
      }
    }
    
    order = mergedOrder;
  } else {
    order = defaultOrder;
  }

  const renderColumn = (columnId: ColumnId): React.ReactNode => {
    switch (columnId) {
      case 'position':
        return (
          <td
            key="position"
            className={`text-center text-white px-2 ${isPlayer ? `${getTailwindStyle(classColor).classHeader}` : ''}`}
          >
            {position}
          </td>
        );

      case 'carNumber':
        if (!carNumber) return null;
        return (
          <td
            key="carNumber"
            className={[
              getTailwindStyle(classColor).driverIcon,
              'border-l-4',
              'text-white text-right px-1 w-10',
            ].join(' ')}
          >
            {`#${carNumber}`}
          </td>
        );

      case 'name':
        return (
          <td
            key="name"
            className="px-2 py-0.5 w-full max-w-0 overflow-hidden"
          >
            <div className="flex justify-between align-center items-center">
              <div className="flex-1 flex items-center overflow-hidden">
                {flairId && (
                  <CountryFlag flairId={flairId} size="sm" className="mr-2 shrink-0" />
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
        );

      case 'badge':
        if (!badge) return null;
        return <td key="badge">{badge}</td>;

      case 'iratingChange':
        if (!iratingChange) return null;
        return (
          <td key="iratingChange" className="px-2 text-left">
            {iratingChange}
          </td>
        );

      case 'delta':
        if (delta === undefined) return null;
        return (
          <td key="delta" className="px-2">
            {delta.toFixed(1)}
          </td>
        );

      case 'fastestTime':
        if (fastestTime === undefined) return null;
        return (
          <td
            key="fastestTime"
            className={`px-2 ${hasFastestTime ? 'text-purple-400' : ''}`}
          >
            {fastestTimeString}
          </td>
        );

      case 'lastTime':
        if (lastTime === undefined) return null;
        return (
          <td
            key="lastTime"
            className={`px-2 ${getLastTimeColorClass(lastTimeState)}`}
          >
            {lastTimeString}
          </td>
        );

      case 'tireCompound':
        if (tireCompound === undefined) return null;
        return (
          <td key="tireCompound">
            <div className="flex items-center pr-1">
              <Compound tireCompound={tireCompound} size="sm" />
            </div>
          </td>
        );

      default:
        return null;
    }
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
      {order.map(renderColumn)}
    </tr>
  );
};
