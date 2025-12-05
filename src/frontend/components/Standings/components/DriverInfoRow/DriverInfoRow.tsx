import { memo, useMemo } from 'react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime, type TimeFormat } from '@irdashies/utils/time';
import type { LastTimeState } from '../../createStandings';
import type {
  RelativeWidgetSettings,
  StandingsWidgetSettings,
} from '../../../Settings/types';
import { BadgeCell } from './cells/BadgeCell';
import { CarManufacturerCell } from './cells/CarManufacturerCell';
import { CarNumberCell } from './cells/CarNumberCell';
import { CompoundCell } from './cells/CompoundCell';
import { CountryFlagsCell } from './cells/CountryFlagsCell';
import { DeltaCell } from './cells/DeltaCell';
import { DriverNameCell } from './cells/DriverNameCell';
import { FastestTimeCell } from './cells/FastestTimeCell';
import { IratingChangeCell } from './cells/IratingChangeCell';
import { LapTimeDeltasCell } from './cells/LapTimeDeltasCell';
import { LastTimeCell } from './cells/LastTimeCell';
import { PitStatusCell } from './cells/PitStatusCell';
import { PositionCell } from './cells/PositionCell';

interface DriverRowInfoProps {
  carIdx: number;
  classColor: number;
  carNumber?: string;
  name: string;
  isPlayer: boolean;
  hasFastestTime: boolean;
  delta?: number;
  gap?: number;
  interval?: number;
  lapsDown?: number;
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
  lastPitLap?: number;
  lastLap?: number;
  prevCarTrackSurface?: number;
  carTrackSurface?: number;
  currentSessionType?: string;
  highlightColor?: number;
  dnf: boolean;
  repair: boolean;
  penalty: boolean;
  slowdown: boolean;
}

export const DriverInfoRow = memo(
  ({
    carIdx,
    carNumber,
    classColor,
    name,
    isPlayer,
    hasFastestTime,
    delta,
    gap,
    interval,
    lapsDown,
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
    config,
    lastPitLap,
    lastLap,
    prevCarTrackSurface,
    carTrackSurface,
    currentSessionType,
    highlightColor = 960745,
    dnf,
    repair,
    penalty,
    slowdown,
  }: DriverRowInfoProps) => {
    const lastTimeString = useMemo(() => {
      const format = config?.lastTime?.timeFormat ?? 'full';
      return formatTime(lastTime, format as TimeFormat);
    }, [lastTime, config?.lastTime?.timeFormat]);

    const fastestTimeString = useMemo(() => {
      const format = config?.fastestTime?.timeFormat ?? 'full';
      return formatTime(fastestTime, format as TimeFormat);
    }, [fastestTime, config?.fastestTime?.timeFormat]);

    const offTrack = carTrackSurface === 0 ? true : false;

    const tailwindStyles = useMemo(() => {
      return getTailwindStyle(classColor, highlightColor, isMultiClass);
    }, [classColor, highlightColor, isMultiClass]);

    const emptyLapDeltaPlaceholders = useMemo(() => {
      if (!numLapDeltasToShow) return null;
      return Array.from({ length: numLapDeltasToShow }, (_, index) => index);
    }, [numLapDeltasToShow]);

    const columnDefinitions = useMemo(() => {
      const columns = [
        {
          id: 'position',
          shouldRender:
            (displayOrder ? displayOrder.includes('position') : true) &&
            (config?.position?.enabled ?? true),
          component: (
            <PositionCell
              key="position"
              hidden={hidden}
              position={position}
              isPlayer={isPlayer}
              offTrack={offTrack}
              tailwindStyles={tailwindStyles}
            />
          ),
        },
        {
          id: 'carNumber',
          shouldRender:
            (displayOrder ? displayOrder.includes('carNumber') : true) &&
            (config?.carNumber?.enabled ?? true),
          component: (
            <CarNumberCell
              key="carNumber"
              hidden={hidden}
              carNumber={carNumber}
              tailwindStyles={tailwindStyles}
            />
          ),
        },
        {
          id: 'countryFlags',
          shouldRender:
            (displayOrder ? displayOrder.includes('countryFlags') : true) &&
            (config?.countryFlags?.enabled ?? true),
          component: (
            <CountryFlagsCell
              key="countryFlags"
              hidden={hidden}
              flairId={flairId}
            />
          ),
        },
        {
          id: 'driverName',
          shouldRender:
            (displayOrder ? displayOrder.includes('driverName') : true) &&
            (config?.driverName?.enabled ?? true),
          component: (
            <DriverNameCell
              key="driverName"
              hidden={hidden}
              name={name}
              radioActive={radioActive}
            />
          ),
        },
        {
          id: 'pitStatus',
          shouldRender:
            (displayOrder ? displayOrder.includes('pitStatus') : true) &&
            (config?.pitStatus?.enabled ?? true),
          component: (
            <PitStatusCell
              key="pitStatus"
              hidden={hidden}
              onPitRoad={onPitRoad}
              carTrackSurface={carTrackSurface}
              prevCarTrackSurface={prevCarTrackSurface}
              lastPitLap={lastPitLap}
              lastLap={lastLap}
              currentSessionType={currentSessionType}
              dnf={dnf}
              repair={repair}
              penalty={penalty}
              slowdown={slowdown}
            />
          ),
        },
        {
          id: 'carManufacturer',
          shouldRender:
            (displayOrder ? displayOrder.includes('carManufacturer') : true) &&
            (config?.carManufacturer?.enabled ?? true),
          component: (
            <CarManufacturerCell
              key="carManufacturer"
              hidden={hidden}
              carId={carId}
            />
          ),
        },
        {
          id: 'badge',
          shouldRender:
            (displayOrder ? displayOrder.includes('badge') : true) &&
            (config?.badge?.enabled ?? true),
          component: <BadgeCell key="badge" hidden={hidden} badge={badge} />,
        },
        {
          id: 'iratingChange',
          shouldRender:
            (displayOrder ? displayOrder.includes('iratingChange') : true) &&
            (config?.iratingChange?.enabled ?? false),
          component: (
            <IratingChangeCell
              key="iratingChange"
              hidden={hidden}
              iratingChange={iratingChange}
            />
          ),
        },
        {
          id: 'delta',
          shouldRender:
            (displayOrder ? displayOrder.includes('delta') : true) &&
            (config?.delta?.enabled ?? true) &&
            !(config && 'gap' in config),
          component: <DeltaCell key="delta" hidden={hidden} delta={delta} />,
        },
        {
          id: 'gap',
          shouldRender:
            (displayOrder ? displayOrder.includes('gap') : true) &&
            (config && 'gap' in config ? config.gap.enabled : false) &&
            currentSessionType?.toLowerCase() === 'race',
          component: <DeltaCell key="gap" hidden={hidden} delta={gap} lapsDown={lapsDown} showDashForUndefined={true} />,
        },
        {
          id: 'interval',
          shouldRender:
            (displayOrder ? displayOrder.includes('interval') : true) &&
            (config && 'interval' in config
              ? config.interval.enabled
              : false) &&
            currentSessionType?.toLowerCase() === 'race',
          component: (
            <DeltaCell
              key="interval"
              hidden={hidden}
              delta={interval}
              showDashForUndefined={true}
            />
          ),
        },
        {
          id: 'fastestTime',
          shouldRender:
            (displayOrder ? displayOrder.includes('fastestTime') : true) &&
            (config?.fastestTime?.enabled ?? false),
          component: (
            <FastestTimeCell
              key="fastestTime"
              hidden={hidden}
              fastestTimeString={fastestTimeString}
              hasFastestTime={hasFastestTime}
            />
          ),
        },
        {
          id: 'lastTime',
          shouldRender:
            (displayOrder ? displayOrder.includes('lastTime') : true) &&
            (config?.lastTime?.enabled ?? false),
          component: (
            <LastTimeCell
              key="lastTime"
              hidden={hidden}
              lastTimeString={lastTimeString}
              lastTimeState={lastTimeState}
            />
          ),
        },
        {
          id: 'compound',
          shouldRender:
            (displayOrder ? displayOrder.includes('compound') : true) &&
            (config?.compound?.enabled ?? false),
          component: (
            <CompoundCell
              key="compound"
              hidden={hidden}
              tireCompound={tireCompound}
              carId={carId}
            />
          ),
        },
        {
          id: 'lapTimeDeltas',
          shouldRender:
            (displayOrder ? displayOrder.includes('lapTimeDeltas') : false) &&
            (config && 'lapTimeDeltas' in config
              ? config.lapTimeDeltas.enabled
              : false),
          component: (
            <LapTimeDeltasCell
              key="lapTimeDeltas"
              hidden={hidden}
              lapTimeDeltas={lapTimeDeltas}
              emptyLapDeltaPlaceholders={emptyLapDeltaPlaceholders}
              isPlayer={isPlayer}
            />
          ),
        },
      ];

      if (displayOrder) {
        const orderedColumns = displayOrder
          .map((orderId) => columns.find((col) => col.id === orderId))
          .filter(
            (col): col is NonNullable<typeof col> =>
              col !== undefined && col.shouldRender
          );

        const remainingColumns = columns.filter(
          (col) => col.shouldRender && !displayOrder.includes(col.id)
        );

        return [...orderedColumns, ...remainingColumns];
      }

      return columns.filter((col) => col.shouldRender);
    }, [
      displayOrder,
      config,
      hidden,
      position,
      isPlayer,
      offTrack,
      tailwindStyles,
      carNumber,
      flairId,
      name,
      radioActive,
      onPitRoad,
      carTrackSurface,
      prevCarTrackSurface,
      lastPitLap,
      lastLap,
      currentSessionType,
      dnf,
      repair,
      penalty,
      slowdown,
      carId,
      badge,
      iratingChange,
      delta,
      gap,
      interval,
      lapsDown,
      fastestTimeString,
      hasFastestTime,
      lastTimeString,
      lastTimeState,
      tireCompound,
      lapTimeDeltas,
      emptyLapDeltaPlaceholders,
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
        {columnDefinitions.map((column) => column.component)}
      </tr>
    );
  }
);

DriverInfoRow.displayName = 'DriverInfoRow';
