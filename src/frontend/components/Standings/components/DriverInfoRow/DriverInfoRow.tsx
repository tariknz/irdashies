import { memo, useMemo } from 'react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime, type TimeFormat } from '@irdashies/utils/time';
import {
  usePitStopDuration,
  usePitLaneStore,
  useDashboard,
} from '@irdashies/context';
import type { ResolvedDriverTag } from '../../hooks/useDriverTagMap';
import type { Gap, LastTimeState } from '../../createStandings';
import type {
  RelativeWidgetSettings,
  StandingsWidgetSettings,
} from '@irdashies/types';
import { AvgLapTimeCell } from './cells/AvgLapTimeCell';
import { BadgeCell } from './cells/BadgeCell';
import { CarManufacturerCell } from './cells/CarManufacturerCell';
import { CarNumberCell } from './cells/CarNumberCell';
import { CompoundCell } from './cells/CompoundCell';
import { CountryFlagsCell } from './cells/CountryFlagsCell';
import { DeltaCell } from './cells/DeltaCell';
import { DriverNameCell } from './cells/DriverNameCell';
import { DriverTagCell } from './cells/DriverTagCell';
import { FastestTimeCell } from './cells/FastestTimeCell';
import { IratingChangeCell } from './cells/IratingChangeCell';
import { LapTimeDeltasCell } from './cells/LapTimeDeltasCell';
import { PositionChangeCell } from './cells/PositionChangeCell';
import { LastTimeCell } from './cells/LastTimeCell';
import { PitStatusCell } from './cells/PitStatusCell';
import { PositionCell } from './cells/PositionCell';
import { TeamNameCell } from './cells/TeamNameCell';
import { RotatingSlotCell } from './cells/RotatingSlotCell';
import { ReactElement, cloneElement } from 'react';

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
  positionChange?: number;
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
  avgLapTime?: number;
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
  resolvedTag?: ResolvedDriverTag;
  hasAnyDriverTag?: boolean;
  compactMode?: string;
  animationCycleTime?: number;
}

// Helper function to provide dummy data for hidden rows
const getDummyData = () => ({
  position: 1,
  carNumber: '1',
  name: 'Driver Name',
  teamName: 'Team Name',
  delta: 0,
  fastestTime: 60000, // 1:00.000
  lastTime: 60000, // 1:00.000
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
    positionChange: 0,
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

export const DriverInfoRow = memo((props: DriverRowInfoProps) => {
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
    positionChange,
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
    avgLapTime,
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
    resolvedTag,
    hasAnyDriverTag,
    compactMode,
    animationCycleTime,
  } = displayProps;
  const pitStopDurations = usePitStopDuration();
  const pitStopDuration =
    pitStopDurationProp ?? pitStopDurations[carIdx] ?? null;

  const pitExitPct = usePitLaneStore((s) => s.pitExitPct);

  const { currentDashboard } = useDashboard();
  const tagSettings = currentDashboard?.generalSettings?.driverTagSettings;
  // When pit exit is in the last 15% of the lap, the S/F line is reached
  // very shortly after exiting pits. OUT must persist for one extra lap count.
  const pitExitAfterSF = pitExitPct !== null && pitExitPct > 0.85;

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

  const badgeMinimal = config?.stylingOptions?.badge ?? false;
  const statusBadgesMinimal = config?.stylingOptions?.statusBadges ?? false;
  const positionBackground =
    config?.stylingOptions?.driverPosition?.background ?? true;
  const numberBackground =
    config?.stylingOptions?.driverNumber?.background ?? true;
  const numberBorder = config?.stylingOptions?.driverNumber?.border ?? true;

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
            position={position}
            isPlayer={isPlayer}
            offTrack={offTrack}
            tailwindStyles={tailwindStyles}
            showBackground={positionBackground}
            compactMode={compactMode}
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
            showBackground={numberBackground}
            showBorder={numberBorder}
            compactMode={compactMode}
          />
        ),
      },
      {
        id: 'driverTag',
        shouldRender:
          (displayOrder ? displayOrder.includes('driverTag') : true) &&
          (hasAnyDriverTag ?? false),
        component: (
          <DriverTagCell
            key="driverTag"
            tag={resolvedTag}
            widthPx={
              tagSettings?.display?.widthPx ?? config?.driverTag?.widthPx
            }
            displayStyle={tagSettings?.display?.displayStyle ?? 'badge'}
            iconWeight={tagSettings?.display?.iconWeight}
            hidden={!!hidden}
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
            flairId={flairId}
            compactMode={compactMode}
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
            isMinimalStatusBadges={statusBadgesMinimal}
            removeNumbersFromName={
              config?.driverName?.removeNumbersFromName ?? false
            }
            fullName={name}
            nameFormat={config?.driverName?.nameFormat}
            label={resolvedTag?.label}
            nameDisplay={tagSettings?.display?.nameDisplay}
            animationCycleTime={animationCycleTime}
            compactMode={compactMode}
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
            teamName={teamName}
            compactMode={compactMode}
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
            pitExitAfterSF={pitExitAfterSF}
            isMinimal={statusBadgesMinimal}
            compactMode={compactMode}
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
            compactMode={compactMode}
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
            isMinimal={badgeMinimal}
            compactMode={compactMode}
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
        id: 'positionChange',
        shouldRender:
          (displayOrder ? displayOrder.includes('positionChange') : true) &&
          (config && 'positionChange' in config
            ? (config.positionChange?.enabled ?? false)
            : false),
        component: (
          <PositionChangeCell
            key="positionChange"
            positionChange={positionChange}
            compactMode={compactMode}
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
            compactMode={compactMode}
          />
        ),
      },
      {
        id: 'gap',
        shouldRender:
          (displayOrder ? displayOrder.includes('gap') : true) &&
          (config && 'gap' in config ? config.gap.enabled : false),
        component: (
          <DeltaCell
            key="gap"
            delta={gap}
            showForUndefined={position === 1 ? 'gap' : undefined}
            decimalPlaces={
              config && 'gap' in config
                ? (config.gap.decimalPlaces ?? 1)
                : deltaDecimalPlaces
            }
            compactMode={compactMode}
          />
        ),
      },
      {
        id: 'interval',
        shouldRender:
          (displayOrder ? displayOrder.includes('interval') : true) &&
          (config && 'interval' in config ? config.interval.enabled : false),
        component: (
          <DeltaCell
            key="interval"
            delta={interval}
            showForUndefined={position === 1 ? 'int' : undefined}
            decimalPlaces={
              config && 'interval' in config
                ? (config.interval.decimalPlaces ?? 1)
                : deltaDecimalPlaces
            }
            compactMode={compactMode}
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
            compactMode={compactMode}
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
            compactMode={compactMode}
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
            compactMode={compactMode}
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
            compactMode={compactMode}
          />
        ),
      },
      {
        id: 'avgLapTime',
        shouldRender:
          (displayOrder ? displayOrder.includes('avgLapTime') : false) &&
          (config && 'avgLapTime' in config
            ? config.avgLapTime.enabled
            : false),
        component: (
          <AvgLapTimeCell
            key="avgLapTime"
            avgLapTime={avgLapTime}
            timeFormat={
              config && 'avgLapTime' in config
                ? config.avgLapTime.timeFormat
                : undefined
            }
            compactMode={compactMode}
          />
        ),
      },
    ];

    const filteredColumns = columns.filter((col) => col.shouldRender);
    let activeColumns = filteredColumns;

    if (displayOrder) {
      const orderedColumns = displayOrder
        .map((orderId) => filteredColumns.find((col) => col.id === orderId))
        .filter((col): col is NonNullable<typeof col> => col !== undefined);

      const remainingColumns = filteredColumns.filter(
        (col) => !displayOrder.includes(col.id)
      );

      activeColumns = [...orderedColumns, ...remainingColumns];
    }

    // Group rotating columns using explicit rotationGroups config
    const result: ReactElement[] = [];
    const handledColumnIds = new Set<string>();
    const rotationGroups = config?.rotationGroups || [];

    let i = 0;
    while (i < activeColumns.length) {
      const col = activeColumns[i];

      // Check if this column belongs to a rotation group
      const group = (rotationGroups || []).find((g) =>
        g?.columns?.includes(col.id)
      );

      if (group && !handledColumnIds.has(col.id)) {
        // This column is the start of a rotation group we haven't processed yet
        // Map column IDs to their component definitions
        const groupColumns = group.columns
          .map((id) => activeColumns.find((c) => c.id === id))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);

        if (groupColumns.length > 1) {
          result.push(
            <RotatingSlotCell
              key={`rotation-group-${group.columns.join('-')}`}
              animationCycleTime={animationCycleTime}
              compactMode={compactMode}
            >
              {groupColumns.map((g) =>
                cloneElement(
                  g.component as ReactElement<{ inRotationGroup?: boolean }>,
                  { inRotationGroup: true }
                )
              )}
            </RotatingSlotCell>
          );

          // Mark all columns in this group as handled
          group.columns.forEach((id) => handledColumnIds.add(id));

          // If the current column was part of this group, we're done with it
          i++;
          continue;
        }
      }

      // If not part of a group or already handled as part of a group,
      // and not already handled, add it as a normal column
      if (!handledColumnIds.has(col.id)) {
        result.push(col.component as ReactElement);
        handledColumnIds.add(col.id);
      }

      i++;
    }

    return result;
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
    positionChange,
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
    avgLapTime,
    hideCarManufacturer,
    pitExitAfterSF,
    tagSettings,
    resolvedTag,
    hasAnyDriverTag,
    hidden,
    badgeMinimal,
    statusBadgesMinimal,
    positionBackground,
    numberBackground,
    numberBorder,
    compactMode,
    animationCycleTime,
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
      {columnDefinitions}
    </tr>
  );
});

DriverInfoRow.displayName = 'DriverInfoRow';
