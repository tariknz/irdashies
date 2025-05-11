import { DriverRatingBadge } from './DriverRatingBadge/DriverRatingBadge';
import { DriverInfoRow } from './DriverInfoRow/DriverInfoRow';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverClassHeader } from './DriverClassHeader/DriverClassHeader';
import { SessionBar } from './SessionBar/SessionBar';
import { Fragment } from 'react/jsx-runtime';
import { StandingsWithIRatingGain } from './hooks';
import { useCarClassStats, useDriverStandings } from './hooks';
import { SessionFooter } from './SessionFooter/SessionFooter';

export const Standings = () => {
  const [parent] = useAutoAnimate();
  const standings = useDriverStandings({ buffer: 3 });
  const classStats = useCarClassStats();

  return (
    <div className="w-full h-full">
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
                  carNumber={result.driver?.carNum || ''}
                  name={result.driver?.name || ''}
                  isPlayer={result.isPlayer}
                  hasFastestTime={result.hasFastestTime}
                  delta={result.delta}
                  position={result.classPosition}
                  iratingChange={(result as StandingsWithIRatingGain).iratingChange}
                  lastTime={result.lastTime}
                  fastestTime={result.fastestTime}
                  onPitRoad={result.onPitRoad}
                  onTrack={result.onTrack}
                  radioActive={result.radioActive}
                  badge={
                    <DriverRatingBadge
                      license={result.driver?.license}
                      rating={result.driver?.rating}
                    />
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
