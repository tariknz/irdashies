import { Fragment } from 'react';
import { DriverClassHeader } from './components/DriverClassHeader/DriverClassHeader';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { SessionBar } from './components/SessionBar/SessionBar';

import { TitleBar } from './components/TitleBar/TitleBar';
import {
  useCarClassStats,
  useDriverStandings,
  useStandingsSettings,
  useHighlightColor,
} from './hooks';
import { useGeneralSettings } from '@irdashies/context';
import { useLapTimesStoreUpdater } from '../../context/LapTimesStore/LapTimesStoreUpdater';
import { usePitLapStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';
import {
  useDrivingState,
  useWeekendInfoNumCarClasses,
  useWeekendInfoTeamRacing,
  useSessionVisibility,
} from '@irdashies/context';
import { useIsSingleMake } from './hooks/useIsSingleMake';

export const Standings = () => {
  const settings = useStandingsSettings();
  const generalSettings = useGeneralSettings();
  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  // Update lap times store with telemetry data (only for this overlay)
  useLapTimesStoreUpdater();

  // Update pit laps
  usePitLapStoreUpdater();

  const standings = useDriverStandings(settings);
  const classStats = useCarClassStats();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;
  const highlightColor = useHighlightColor();

  // Determine whether we should hide the car manufacturer column
  const isSingleMake = useIsSingleMake();
  const hideCarManufacturer = !!(
    settings?.carManufacturer?.hideIfSingleMake && isSingleMake
  );

  const topDriverDivider =
    settings?.driverStandings?.topDriverDivider ?? 'none';
  const numTopDrivers = settings?.driverStandings?.numTopDrivers ?? 0;

  // Check if this is a team racing session
  const isTeamRacing = useWeekendInfoTeamRacing();

  // Determine table border spacing based on compact mode
  const tableBorderSpacing = generalSettings?.compactMode
    ? 'border-spacing-y-0'
    : 'border-spacing-y-0.5';

  const isMinimal = settings?.uiStyle === 'minimal';

  if (!isSessionVisible) return <></>;

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  return (
    <div
      className={`w-full bg-slate-800/(--bg-opacity) rounded-sm ${!generalSettings?.compactMode ? 'p-2' : ''} text-white overflow-hidden`}
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 0}%`,
      }}
    >
      <TitleBar titleBarSettings={settings?.titleBar} />
      {(settings?.headerBar?.enabled ?? true) && (
        <SessionBar position="header" variant="standings" />
      )}
      <table
        className={`w-full table-auto text-sm border-separate ${tableBorderSpacing}`}
      >
        <tbody>
          {standings.map(([classId, classStandings], index) => {
            // Compute divider color once per class
            // Priority: theme selected → CSS theme var; multi-class → class color; else → highlight
            const classColorNum = classStats?.[classId]?.color;
            const classColorHex =
              classColorNum !== undefined
                ? `#${classColorNum.toString(16).padStart(6, '0')}`
                : undefined;
            const highlightHex = `#${highlightColor.toString(16).padStart(6, '0')}`;
            // var(--color-slate-500) inherits from ThemeManager's CSS remapping,
            // resolving to the user's selected theme color at runtime.
            const dividerColor =
              topDriverDivider === 'theme'
                ? 'var(--color-slate-500)'
                : isMultiClass
                  ? (classColorHex ?? highlightHex)
                  : highlightHex;

            return classStandings.length > 0 ? (
              <Fragment key={classId}>
                <DriverClassHeader
                  key={classId}
                  className={classStats?.[classId]?.shortName}
                  classColor={
                    isMultiClass ? classStats?.[classId]?.color : highlightColor
                  }
                  totalDrivers={classStats?.[classId]?.total}
                  sof={classStats?.[classId]?.sof}
                  highlightColor={highlightColor}
                  isMultiClass={isMultiClass}
                  isMinimal={isMinimal}
                  colSpan={12}
                />
                {classStandings.map((result, driverIndex) => {
                  const prev = classStandings[driverIndex - 1];
                  const showDivider =
                    topDriverDivider !== 'none' &&
                    numTopDrivers > 0 &&
                    driverIndex > 0 &&
                    prev?.classPosition !== undefined &&
                    result.classPosition !== undefined &&
                    prev.classPosition <= numTopDrivers &&
                    result.classPosition > numTopDrivers &&
                    result.classPosition > prev.classPosition + 1;

                  return (
                    <Fragment key={result.carIdx}>
                      {showDivider && (
                        <tr>
                          <td colSpan={12} className="px-2 py-0.5">
                            <hr
                              className="border-2 border-t"
                              style={{
                                borderColor: dividerColor,
                                opacity: 0.5,
                              }}
                            />
                          </td>
                        </tr>
                      )}
                      <DriverInfoRow
                        key={result.carIdx}
                        carIdx={result.carIdx}
                        classColor={result.carClass.color}
                        carNumber={
                          (settings?.carNumber?.enabled ?? true)
                            ? result.driver?.carNum || ''
                            : undefined
                        }
                        name={result.driver?.name || ''}
                        teamName={
                          settings?.teamName?.enabled && isTeamRacing
                            ? result.driver?.teamName || ''
                            : undefined
                        }
                        isPlayer={result.isPlayer}
                        hasFastestTime={result.hasFastestTime}
                        delta={
                          settings?.delta?.enabled ? result.delta : undefined
                        }
                        gap={settings?.gap?.enabled ? result.gap : undefined}
                        interval={
                          settings?.interval?.enabled
                            ? result.interval
                            : undefined
                        }
                        position={result.classPosition}
                        lap={result.lastLap}
                        iratingChangeValue={result.iratingChange}
                        positionChange={result.positionChange}
                        lastTime={
                          settings?.lastTime?.enabled
                            ? result.lastTime
                            : undefined
                        }
                        fastestTime={
                          settings?.fastestTime?.enabled
                            ? result.fastestTime
                            : undefined
                        }
                        lastTimeState={
                          settings?.lastTime?.enabled
                            ? result.lastTimeState
                            : undefined
                        }
                        onPitRoad={result.onPitRoad}
                        onTrack={result.onTrack}
                        radioActive={result.radioActive}
                        isMultiClass={isMultiClass}
                        flairId={
                          (settings?.countryFlags?.enabled ?? true)
                            ? result.driver?.flairId
                            : undefined
                        }
                        tireCompound={
                          (settings?.compound?.enabled ?? true)
                            ? result.tireCompound
                            : undefined
                        }
                        carId={result.carId}
                        lastPitLap={result.lastPitLap}
                        lastLap={result.lastLap}
                        carTrackSurface={result.carTrackSurface}
                        prevCarTrackSurface={result.prevCarTrackSurface}
                        license={result.driver?.license}
                        rating={result.driver?.rating}
                        lapTimeDeltas={
                          settings?.lapTimeDeltas?.enabled
                            ? result.lapTimeDeltas
                            : undefined
                        }
                        numLapDeltasToShow={
                          settings?.lapTimeDeltas?.enabled
                            ? settings.lapTimeDeltas.numLaps
                            : undefined
                        }
                        displayOrder={settings?.displayOrder}
                        currentSessionType={result.currentSessionType}
                        config={settings}
                        highlightColor={highlightColor}
                        dnf={result.dnf}
                        repair={result.repair}
                        penalty={result.penalty}
                        slowdown={result.slowdown}
                        hideCarManufacturer={hideCarManufacturer}
                        isMinimal={isMinimal}
                      />
                    </Fragment>
                  );
                })}
                {index < standings.length - 1 &&
                  !generalSettings?.compactMode && (
                    <tr>
                      <td colSpan={12} className="h-2"></td>
                    </tr>
                  )}
              </Fragment>
            ) : null;
          })}
        </tbody>
      </table>
      {(settings?.footerBar?.enabled ?? true) && (
        <SessionBar position="footer" variant="standings" />
      )}
    </div>
  );
};
