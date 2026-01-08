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
import { useLapTimesStoreUpdater } from '../../context/LapTimesStore/LapTimesStoreUpdater';
import { usePitLapStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';
import { useDrivingState, useWeekendInfoNumCarClasses, useWeekendInfoTeamRacing } from '@irdashies/context';
import { useIsSingleMake } from './hooks/useIsSingleMake';

export const Standings = () => {
  const settings = useStandingsSettings();
  const { isDriving } = useDrivingState();

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
  const hideCarManufacturer = !!(settings?.carManufacturer?.hideIfSingleMake && isSingleMake);

  // Check if this is a team racing session
  const isTeamRacing = useWeekendInfoTeamRacing();

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  return (
    <div
      className={`w-full bg-slate-800/(--bg-opacity) rounded-sm p-2 text-white overflow-hidden`}
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 0}%`,
      }}
    >
      <TitleBar titleBarSettings={settings?.titleBar} />
      {(settings?.headerBar?.enabled ?? true) && <SessionBar position="header" variant="standings" />}
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
        <tbody>
          {standings.map(([classId, classStandings], index) => (
            classStandings.length > 0 ? (
              <Fragment key={classId}>
                <DriverClassHeader
                  key={classId}
                  className={classStats?.[classId]?.shortName}
                  classColor={isMultiClass ? classStats?.[classId]?.color : highlightColor}
                  totalDrivers={classStats?.[classId]?.total}
                  sof={classStats?.[classId]?.sof}
                  highlightColor={highlightColor}
                  isMultiClass={isMultiClass}
                  colSpan={12}
                />
                {classStandings.map((result) => (
                  <DriverInfoRow
                    key={result.carIdx}
                    carIdx={result.carIdx}
                    classColor={result.carClass.color}
                    carNumber={settings?.carNumber?.enabled ?? true ? result.driver?.carNum || '' : undefined}
                    name={result.driver?.name || ''}
                    teamName={settings?.teamName?.enabled && isTeamRacing ? result.driver?.teamName || '' : undefined}
                    isPlayer={result.isPlayer}
                    hasFastestTime={result.hasFastestTime}
                    delta={settings?.delta?.enabled ? result.delta : undefined}
                    gap={settings?.gap?.enabled ? result.gap : undefined}
                    interval={settings?.interval?.enabled ? result.interval : undefined}
                    position={result.classPosition}
                    iratingChangeValue={result.iratingChange}
                    lastTime={settings?.lastTime?.enabled ? result.lastTime : undefined}
                    fastestTime={settings?.fastestTime?.enabled ? result.fastestTime : undefined}
                    lastTimeState={settings?.lastTime?.enabled ? result.lastTimeState : undefined}
                    onPitRoad={result.onPitRoad}
                    onTrack={result.onTrack}
                    radioActive={result.radioActive}
                    isMultiClass={isMultiClass}
                    flairId={settings?.countryFlags?.enabled ?? true ? result.driver?.flairId : undefined}
                    tireCompound={settings?.compound?.enabled ?? true ? result.tireCompound : undefined}
                    carId={result.carId}
                    lastPitLap={result.lastPitLap}
                    lastLap={result.lastLap}
                    carTrackSurface={result.carTrackSurface}
                    prevCarTrackSurface={result.prevCarTrackSurface}
                    license={result.driver?.license}
                    rating={result.driver?.rating}
                    lapTimeDeltas={settings?.lapTimeDeltas?.enabled ? result.lapTimeDeltas : undefined}
                    numLapDeltasToShow={settings?.lapTimeDeltas?.enabled ? settings.lapTimeDeltas.numLaps : undefined}
                    displayOrder={settings?.displayOrder}
                    currentSessionType={result.currentSessionType}
                    config={settings}
                    highlightColor={highlightColor}
                    dnf={result.dnf}
                    repair={result.repair}
                    penalty={result.penalty}
                    slowdown={result.slowdown}
                    hideCarManufacturer={hideCarManufacturer}
                  />
                ))}
                {index < standings.length - 1 && <tr><td colSpan={12} className="h-2"></td></tr>}
              </Fragment>
            ) : null
          ))}
        </tbody>
      </table>
      {(settings?.footerBar?.enabled ?? true) && <SessionBar position="footer" variant="standings" />}
    </div>
  );
};
