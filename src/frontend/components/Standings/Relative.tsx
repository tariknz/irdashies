import { useMemo } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { useRelativeSettings, useDriverRelatives } from './hooks';
import { useDrivingState } from '@irdashies/context';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';
import { TitleBar } from './components/TitleBar/TitleBar';

export const Relative = () => {
  const config = useRelativeSettings();
  const { isDriving } = useDrivingState();

  const buffer = config?.buffer ?? 3;
  const standings = useDriverRelatives({ buffer });
  const [parent] = useAutoAnimate();
  const isMultiClass = standings.length > 0 && new Set(standings.map(s => s.carClass.id)).size > 1;

  // Calculate display flags for manufacturer and compound columns
  const uniqueCarIds = new Set(standings.filter(d => d.carId).map(d => d.carId));
  const uniqueTireCompounds = new Set(standings.map(d => d.tireCompound));
  const showManufacturer = uniqueCarIds.size > 1 && config?.carManufacturer?.enabled;
  const showCompound = uniqueTireCompounds.size > 1 && config?.compound?.enabled;

  // Always render 2 * buffer + 1 rows (buffer above + player + buffer below)
  const totalRows = 2 * buffer + 1;
  
  // Memoize findIndex to avoid recalculating on every render
  const playerIndex = useMemo(
    () => standings.findIndex((result) => result.isPlayer),
    [standings]
  );

  // Memoize rows array creation to avoid recreating on every render
  const rows = useMemo(() => {
    // If no player found, return empty rows
    if (playerIndex === -1) {
      return Array.from({ length: totalRows }, (_, index) => (
        <DummyDriverRow key={`empty-${index}`} showManufacturer={showManufacturer} showCompound={showCompound} />
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
        return <DummyDriverRow key={`placeholder-${index}`} showManufacturer={showManufacturer} showCompound={showCompound} />;
      }

      return (
        <DriverInfoRow
          key={result.carIdx}
          carIdx={ result.carIdx}
          classColor={result.carClass.color}
          carNumber={config?.carNumber?.enabled ?? true ? result.driver?.carNum || '' : undefined}
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
          flairId={config?.countryFlags?.enabled ?? true ? result.driver?.flairId : undefined}
          lastTime={config?.lastTime?.enabled ? result.lastTime : undefined}
          fastestTime={config?.fastestTime?.enabled ? result.fastestTime : undefined}
          lastTimeState={config?.lastTime?.enabled ? result.lastTimeState : undefined}
          tireCompound={config?.compound?.enabled ? result.tireCompound : undefined}
          carId={config?.carManufacturer?.enabled ?? true ? result.carId : undefined}
          isMultiClass={isMultiClass}
          showManufacturer={showManufacturer}
          showCompound={showCompound}
          badge={
            <DriverRatingBadge
              license={result.driver?.license}
              rating={result.driver?.rating}
            />
          }
        />
      );
    });
  }, [standings, playerIndex, totalRows, config, isMultiClass, showManufacturer, showCompound]);

  // Show only when on track setting
  if (config?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  // If no player found, render empty table with consistent height
  if (playerIndex === -1) {
    return (
      <div className="w-full h-full">
        <TitleBar titleBarSettings={config?.titleBar} />
        <SessionBar />
        <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
          <tbody ref={parent}>{rows}</tbody>
        </table>
        <SessionFooter />
      </div>
    );
  }

  return (
    <div
      className="w-full bg-slate-800/(--bg-opacity) rounded-sm p-2"
      style={{
        ['--bg-opacity' as string]: `${config?.background?.opacity ?? 0}%`,
      }}
    >
      <TitleBar titleBarSettings={config?.titleBar} />
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody ref={parent}>{rows}</tbody>
      </table>
      <SessionFooter />
    </div>
  );
};

// Dummy driver row component with visibility hidden to maintain consistent height
const DummyDriverRow = ({ showManufacturer, showCompound }: { showManufacturer: boolean; showCompound: boolean }) => (
  <DriverInfoRow
    carIdx={0}
    classColor={0}
    name="Franz Hermann"
    isPlayer={false}
    hasFastestTime={false}
    hidden={true}
    isMultiClass={false}
    showManufacturer={showManufacturer}
    showCompound={showCompound}
  />
);
