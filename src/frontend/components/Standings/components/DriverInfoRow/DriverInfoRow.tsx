import { memo, useMemo } from 'react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime, type TimeFormat } from '@irdashies/utils/time';
import { usePitStopDuration, useDashboard } from '@irdashies/context';
import type { Gap, LastTimeState } from '../../createStandings';
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
import { TeamNameCell } from './cells/TeamNameCell';

interface DriverRowInfoProps {
  carIdx: number;
  classColor: number;
  carNumber?: string;
  name: string;
  teamName?: string;
  isPlayer: boolean;
  hasFastestTime: boolean;
  delta?: number;
  gap?: Gap;
  interval?: number;
  position?: number;
  lap?: number;
  license?: string;
  rating?: number;
  iratingChangeValue?: number;
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
  pitStopDuration?: number | null;
  highlightColor?: number;
  dnf: boolean;
  repair: boolean;
  penalty: boolean;
  slowdown: boolean;
  deltaDecimalPlaces?: number;
  hideCarManufacturer?: boolean;
}

// Helper function to provide dummy data for hidden rows
const getDummyData = () => ({
  position: 1,
  carNumber: '1',
  name: 'Driver Name',
  teamName: 'Team Name',
  delta: 0,
  fastestTime: 60000, // 1:00.000
  lastTime: 60000,    // 1:00.000
  tireCompound: 0,
  license: 'A 4.99',
  rating: 4999,
  iratingChangeValue: 0,
  lapTimeDeltas: [0, 0, 0], // dummy array for lap time deltas
  gap: undefined,
  interval: undefined,
  lastTimeState: undefined,
  lastPitLap: undefined,
  lastLap: undefined,
  prevCarTrackSurface: undefined,
  carTrackSurface: 1,
  flairId: 2, // iRacing flag
  carId: 122, // Default car ID
});

// Helper function to transform props for hidden rows
const getDisplayProps = (props: DriverRowInfoProps) => {
  if (!props.hidden) return props;
  
  const dummyData = getDummyData();
  
  return {
    ...props,
    // Override with dummy data for hidden rows
    position: dummyData.position,
    carNumber: dummyData.carNumber,
    name: dummyData.name,
    teamName: dummyData.teamName,
    delta: dummyData.delta,
    fastestTime: dummyData.fastestTime,
    lastTime: dummyData.lastTime,
    tireCompound: dummyData.tireCompound,
    license: dummyData.license,
    rating: dummyData.rating,
    iratingChangeValue: dummyData.iratingChangeValue,
    lapTimeDeltas: dummyData.lapTimeDeltas,
    gap: dummyData.gap,
    interval: dummyData.interval,
    lastTimeState: dummyData.lastTimeState,
    lastPitLap: dummyData.lastPitLap,
    lastLap: dummyData.lastLap,
    prevCarTrackSurface: dummyData.prevCarTrackSurface,
    carTrackSurface: dummyData.carTrackSurface,
    flairId: dummyData.flairId,
    carId: dummyData.carId,
  };
};

export const DriverInfoRow = memo(
  (props: DriverRowInfoProps) => {
    // Transform props for hidden rows
    const displayProps = getDisplayProps(props);

    const {
      carIdx,
      carNumber,
      classColor,
      name,
      teamName,
      isPlayer,
      hasFastestTime,
      delta,
      gap,
      interval,
      position,
      lap,
      license,
      rating,
      iratingChangeValue,
      lastTime,
      fastestTime,
      lastTimeState,
      onPitRoad,
      onTrack,
      radioActive,
      isLapped,
      isLappingAhead,
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
      deltaDecimalPlaces,
      pitStopDuration: pitStopDurationProp,
      hideCarManufacturer,
    } = displayProps;
    const { currentDashboard } = useDashboard();
    const tagSettings = currentDashboard?.generalSettings?.driverTagSettings;
    const widgetDriverTag = config?.driverTag;
    const pitStopDurations = usePitStopDuration();
    const pitStopDuration =
      pitStopDurationProp ?? pitStopDurations[carIdx] ?? null;

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
      const idxDriverTag = (displayOrder ?? []).indexOf('driverTag');
      const idxDriverName = (displayOrder ?? []).indexOf('driverName');
      const driverTagBeforeName =
        idxDriverTag !== -1 && idxDriverName !== -1
          ? idxDriverTag < idxDriverName
          : widgetDriverTag?.position === 'before-name';
      const widgetTagEnabled = widgetDriverTag?.enabled;
      const widgetTagWidthPx = widgetDriverTag?.widthPx;
      const hasDriverTagColumn = (displayOrder ?? []).includes('driverTag');

      const columns = [
        {
          id: 'position',
          shouldRender:
            (displayOrder ? displayOrder.includes('position') : true) &&
            (config?.position?.enabled ?? true),
          component: (
            <PositionCell
              key="position"
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
              carNumber={carNumber}
              tailwindStyles={tailwindStyles}
            />
          ),
        },
        {
          id: 'driverTag',
          shouldRender:
            (displayOrder ? displayOrder.includes('driverTag') : true) &&
            (widgetTagEnabled ?? tagSettings?.display?.enabled),
          component: (
            <td key="driverTag" data-column="driverTag" className="w-auto px-1 py-0.5 whitespace-nowrap">
              {hidden ? null : (() => {
                const key = name ?? '';
                const groupId = tagSettings?.mapping?.[key];
                if (!groupId) return null;
                const group = tagSettings?.groups?.find((g) => g.id === groupId);
                if (!group) return null;
                const colorHex = `#${(group.color ?? 0).toString(16).padStart(6, '0')}`;
                const width = widgetTagWidthPx ?? tagSettings?.display?.widthPx ?? 6;
                return (
                  <span
                    style={{
                      display: 'inline-block',
                      width,
                      height: 18,
                      backgroundColor: colorHex,
                      borderRadius: 1,
                      verticalAlign: 'middle',
                      marginRight: 4,
                    }}
                  />
                );
              })()}
            </td>
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
              radioActive={radioActive}
              repair={repair}
              penalty={penalty}
              slowdown={slowdown}
              showStatusBadges={config?.driverName?.showStatusBadges ?? true}
              fullName={name}
              nameFormat={config?.driverName?.nameFormat}
              tagSettings={tagSettings}
              widgetTagEnabled={widgetTagEnabled}
              widgetTagBeforeName={driverTagBeforeName}
              widgetTagWidthPx={widgetTagWidthPx}
              skipWidgetTag={hasDriverTagColumn}
            />
          ),
        },
        {
          id: 'teamName',
          shouldRender:
            teamName !== undefined &&
            (displayOrder ? displayOrder.includes('teamName') : false) &&
            (config?.teamName?.enabled ?? false),
          component: (
            <TeamNameCell 
              key="teamName" 
              teamName={teamName} />
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
              onPitRoad={onPitRoad}
              carTrackSurface={carTrackSurface}
              prevCarTrackSurface={prevCarTrackSurface}
              lap={lap}
              lastPitLap={lastPitLap}
              lastLap={lastLap}
              currentSessionType={currentSessionType}
              dnf={dnf}
              pitStopDuration={pitStopDuration}
              showPitTime={config?.pitStatus?.showPitTime ?? false}
              pitLapDisplayMode={config?.pitStatus?.pitLapDisplayMode}
            />
          ),
        },
        {
          id: 'carManufacturer',
          shouldRender:
            (displayOrder ? displayOrder.includes('carManufacturer') : true) &&
            (config?.carManufacturer?.enabled ?? true) &&
            !hideCarManufacturer,
          component: (
            <CarManufacturerCell
              key="carManufacturer"
              carId={carId}
            />
          ),
        },
        {
          id: 'badge',
          shouldRender:
            (displayOrder ? displayOrder.includes('badge') : true) &&
            (config?.badge?.enabled ?? true),
          component: (
            <BadgeCell
              key="badge"
              license={license}
              rating={rating}
              badgeFormat={config?.badge?.badgeFormat}
            />
          ),
        },
        {
          id: 'iratingChange',
          shouldRender:
            (displayOrder ? displayOrder.includes('iratingChange') : true) &&
            (config?.iratingChange?.enabled ?? false),
          component: (
            <IratingChangeCell
              key="iratingChange"
              iratingChangeValue={iratingChangeValue}
            />
          ),
        },
        {
          id: 'delta',
          shouldRender:
            (displayOrder ? displayOrder.includes('delta') : true) &&
            (config?.delta?.enabled ?? true) &&
            !(config && 'gap' in config),
          component: (
            <DeltaCell
              key="delta"
              delta={delta}
              decimalPlaces={deltaDecimalPlaces}
            />
          ),
        },
        {
          id: 'gap',
          shouldRender:
            (displayOrder ? displayOrder.includes('gap') : true) &&
            (config && 'gap' in config ? config.gap.enabled : false) &&
            currentSessionType?.toLowerCase() === 'race',
          component: (
            <DeltaCell
              key="gap"
              delta={gap}
              showForUndefined={position === 1 ? 'gap' : undefined}
              decimalPlaces={deltaDecimalPlaces}
            />
          ),
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
              delta={interval}
              showForUndefined={position === 1 ? 'int' : undefined}
              decimalPlaces={deltaDecimalPlaces}
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
              col !== undefined && !!col.shouldRender
          );

        const remainingColumns = columns.filter(
          (col) => !!col.shouldRender && !displayOrder.includes(col.id)
        );

        return [...orderedColumns, ...remainingColumns];
      }

      return columns.filter((col) => !!col.shouldRender);
    }, [
      displayOrder,
      config,
      position,
      lap,
      isPlayer,
      offTrack,
      tailwindStyles,
      carNumber,
      flairId,
      name,
      teamName,
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
      pitStopDuration,
      carId,
      license,
      rating,
      iratingChangeValue,
      delta,
      deltaDecimalPlaces,
      gap,
      interval,
      fastestTimeString,
      hasFastestTime,
      lastTimeString,
      lastTimeState,
      tireCompound,
      lapTimeDeltas,
      emptyLapDeltaPlaceholders,
      hideCarManufacturer,
      tagSettings,
      widgetDriverTag,
    ]);

    return (
      <tr
        key={carIdx}
        className={[
          !onTrack || onPitRoad ? 'text-white/60' : '',
          isPlayer ? 'text-amber-300' : '',
          isPlayer
            ? 'bg-yellow-500/20'
            : 'odd:bg-slate-800/70 even:bg-slate-900/70 text-sm',
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
