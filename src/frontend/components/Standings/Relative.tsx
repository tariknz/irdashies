import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { useRelativeSettings, useDriverRelatives } from './hooks';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';
import { LapTimesUpdater } from '@irdashies/context';

export const Relative = () => {
  const config = useRelativeSettings();
  const buffer = config?.buffer ?? 3;
  const standings = useDriverRelatives({ buffer });
  const [parent] = useAutoAnimate();

  // Always render 2 * buffer + 1 rows (buffer above + player + buffer below)
  const totalRows = 2 * buffer + 1;
  const playerIndex = standings.findIndex((result) => result.isPlayer);

  const renderTableBody = () => {
    // If no player found, render empty table with consistent height
    if (playerIndex === -1) {
      return Array.from({ length: totalRows }, (_, index) => (
        <DummyDriverRow key={`empty-${index}`} />
      ));
    }

    // Create an array of fixed size with placeholder rows
    return Array.from({ length: totalRows }, (_, index) => {
      // Calculate the actual index in the standings array
      // Center the player in the middle of the display
      const centerIndex = Math.floor(totalRows / 2); // buffer
      const actualIndex = index - centerIndex + playerIndex;
      const result = standings[actualIndex];

      if (!result) {
        // If no result, render a dummy row with visibility hidden
        return <DummyDriverRow key={`placeholder-${index}`} />;
      }

      return (
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
      );
    });
  };

  return (
    <div
      className="w-full bg-slate-800/[var(--bg-opacity)] rounded-sm p-2"
      style={{
        ['--bg-opacity' as string]: `${config?.background?.opacity ?? 0}%`,
      }}
    >
      {config?.experimentalDynamicLapTimes && <LapTimesUpdater />}
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody ref={parent}>{renderTableBody()}</tbody>
      </table>
      <SessionFooter />
    </div>
  );
};

// Dummy driver row component with visibility hidden to maintain consistent height
const DummyDriverRow = () => (
  <DriverInfoRow
    carIdx={0}
    classColor={0}
    carNumber="33"
    name="Franz Hermann"
    isPlayer={false}
    hasFastestTime={false}
    hidden={true}
  />
);
