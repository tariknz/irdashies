import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverInfoRow } from './DriverInfoRow/DriverInfoRow';
import { useDriverRelatives } from './hooks/useDriverRelatives';
import { DriverRatingBadge } from './DriverRatingBadge/DriverRatingBadge';
import { SessionBar } from './SessionBar/SessionBar';
import { SessionFooter } from './SessionFooter/SessionFooter';

export const Relative = () => {
  const standings = useDriverRelatives({ buffer: 5 });
  const [parent] = useAutoAnimate();

  return (
    <div className="w-full h-full">
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody ref={parent}>
          {standings.map((result) => (
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
              onPitRoad={result.onPitRoad}
              onTrack={result.onTrack}
              radioActive={result.radioActive}
              isLapped={result.lappedState === 'behind'}
              isLappingAhead={result.lappedState === 'ahead'}
              badge={
                <DriverRatingBadge
                  license={result.driver?.license}
                  rating={result.driver?.rating}
                />
              }
            />
          ))}
        </tbody>
      </table>
      <SessionFooter />
    </div>
  );
};
