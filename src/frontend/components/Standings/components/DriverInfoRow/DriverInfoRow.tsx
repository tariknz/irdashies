import { memo, useMemo } from 'react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime, type TimeFormat } from '@irdashies/utils/time';
import { usePitStopDuration, useDashboard } from '@irdashies/context';
import { getPresetTag } from '../../../../constants/driverTagBadges';
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

export const DriverInfoRow = memo(
  ({
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
  }: DriverRowInfoProps) => {
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
          : false;
      const widgetTagEnabled = widgetDriverTag?.enabled;
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
          id: 'driverTag',
          shouldRender:
            (displayOrder ? displayOrder.includes('driverTag') : true) &&
            (widgetTagEnabled ?? tagSettings?.display?.enabled),
            component: (
            <td key="driverTag" data-column="driverTag" className="w-auto px-0 py-0.5 whitespace-nowrap">
              {hidden ? null : (() => {
                const key = name ?? '';
                if (!tagSettings?.mapping) return null;
                const found = Object.entries(tagSettings.mapping).find(([k]) => k.toLowerCase() === key.toLowerCase());
                const groupId = found?.[1];
                if (!groupId) return null;
                // prefer user-created groups, then preset overrides, then built-in presets
                const custom = tagSettings.groups?.find(g => g.id === groupId);
                const presetOverride = tagSettings.presetOverrides?.[groupId];
                const preset = getPresetTag(groupId);
                const displayStyle = tagSettings?.display?.displayStyle ?? 'badge';
                if (displayStyle === 'tag') {
                  const colorNum = custom?.color ?? presetOverride?.color ?? preset?.color ?? undefined;
                  const colorHex = colorNum !== undefined ? `#${(colorNum & 0xffffff).toString(16).padStart(6, '0')}` : undefined;
                  if (!colorHex) return null;
                  return (
                    <span style={{ display: 'inline-block', width: 6, height: 18, borderRadius: 2, background: colorHex, verticalAlign: 'middle', marginRight: 8 }} />
                  );
                }

                const icon = custom?.icon ?? presetOverride?.icon ?? preset?.icon ?? '';
                if (!icon) return null;
                return (
                  <span style={{ display: 'inline-block', width: 18, height: 18, lineHeight: '18px', textAlign: 'center', verticalAlign: 'middle', marginRight: 0 }}>
                    {typeof icon === 'string' && icon.startsWith('data:') ? (
                      <img src={icon} alt="tag" style={{ height: 16, width: 16, objectFit: 'contain' }} />
                    ) : (
                      <span className="align-middle">{icon}</span>
                    )}
                  </span>
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
              radioActive={radioActive}
              repair={repair}
              penalty={penalty}
              slowdown={slowdown}
              showStatusBadges={config?.driverName?.showStatusBadges ?? true}
              hidden={hidden}
              fullName={name}
              nameFormat={config?.driverName?.nameFormat}
              tagSettings={tagSettings}
              widgetTagEnabled={widgetTagEnabled}
              widgetTagBeforeName={driverTagBeforeName}
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
            <TeamNameCell key="teamName" hidden={hidden} teamName={teamName} />
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
          component: (
            <BadgeCell
              key="badge"
              hidden={hidden}
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
              hidden={hidden}
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
              hidden={hidden}
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
              hidden={hidden}
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
              hidden={hidden}
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
      hidden,
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
