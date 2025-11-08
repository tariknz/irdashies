import { Fragment } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverClassHeader } from './components/DriverClassHeader/DriverClassHeader';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { RatingChange } from './components/RatingChange/RatingChange';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';
import {
  useCarClassStats,
  useDriverStandings,
  useStandingsSettings,
} from './hooks';

export const Standings = () => {
  const [parent] = useAutoAnimate();
  const settings = useStandingsSettings();
  const standings = useDriverStandings(settings?.driverStandings);
  const classStats = useCarClassStats();
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
                classColor={classStats?.[classId]?.color}
                totalDrivers={classStats?.[classId]?.total}
                sof={classStats?.[classId]?.sof}
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
                    settings?.iRatingChange?.enabled ? (
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
                  flairId={settings?.countryFlags?.enabled ?? true ? result.driver?.flairId : undefined}
                  tireCompound={settings?.compound?.enabled ?? true ? result.tireCompound : undefined}
                  carId={settings?.carManufacturer?.enabled ?? true ? result.carId : undefined}
                  badge={
                    settings?.badge?.enabled ? (
                      <DriverRatingBadge
                        license={result.driver?.license}
                        rating={result.driver?.rating}
                      />
                    ) : undefined
                  }
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
