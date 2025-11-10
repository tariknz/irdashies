import { Fragment } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverClassHeader } from './components/DriverClassHeader/DriverClassHeader';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { RatingChange } from './components/RatingChange/RatingChange';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';
import { useDashboard } from '@irdashies/context';
import {
  useCarClassStats,
  useDriverStandings,
  useStandingsSettings,
} from './hooks';
import { useLapTimesStoreUpdater } from '../../context/LapTimesStore/LapTimesStoreUpdater';
import { usePitLabStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';

export const Standings = () => {
  const [parent] = useAutoAnimate();
  const settings = useStandingsSettings();

  // Update lap times store with telemetry data (only for this overlay)
  useLapTimesStoreUpdater();

  // Update pit laps
  usePitLabStoreUpdater();

  const standings = useDriverStandings(settings);
  const classStats = useCarClassStats();const isMultiClass = standings.length > 1;
  const { currentDashboard } = useDashboard();
  const highlightColor = currentDashboard?.generalSettings?.highlightColor ?? 960745;

  return (
    <div
      className={`w-full bg-slate-800/[var(--bg-opacity)] rounded-sm p-2 text-white overflow-hidden`}
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 0}%`,
      }}
    >
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3">
        <tbody ref={parent}>
          {standings.map(([classId, classStandings]) => (
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
                  isPlayer={result.isPlayer}
                  hasFastestTime={result.hasFastestTime}
                  delta={settings?.delta?.enabled ? result.delta : undefined}
                  position={result.classPosition}
                  iratingChange={
                    settings?.iratingChange?.enabled ? (
                      <RatingChange value={result.iratingChange} />
                    ) : undefined
                  }
                  lastTime={
                    settings?.lastTime?.enabled ? result.lastTime : undefined
                  }
                  fastestTime={
                    settings?.fastestTime?.enabled
                      ? result.fastestTime
                      : undefined
                  }
                  lastTimeState={
                    settings?.lastTime?.enabled ? result.lastTimeState : undefined
                  }
                  onPitRoad={result.onPitRoad}
                  onTrack={result.onTrack}
                  radioActive={result.radioActive}
                  isMultiClass={isMultiClass}
                  flairId={settings?.countryFlags?.enabled ?? true ? result.driver?.flairId : undefined}
                  tireCompound={settings?.compound?.enabled ?? true ? result.tireCompound : undefined}
                  carId={result.carId}
                  lastPitLap={result.lastPitLap}
                  badge={
                    settings?.badge?.enabled ? (
                      <DriverRatingBadge
                        license={result.driver?.license}
                        rating={result.driver?.rating}
                      />
                    ) : undefined
                  }
                  lapTimeDeltas={settings?.lapTimeDeltas?.enabled ? result.lapTimeDeltas : undefined}
                  numLapDeltasToShow={settings?.lapTimeDeltas?.enabled ? settings.lapTimeDeltas.numLaps : undefined}
                  displayOrder={settings?.displayOrder}
                  config={settings}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      <SessionFooter />
    </div>
  );
};
