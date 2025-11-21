import { useMemo } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { useDrivingState } from '@irdashies/context';
import { useRelativeSettings, useDriverRelatives, useDriverStandings } from './hooks';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { RatingChange } from './components/RatingChange/RatingChange';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';
import { TitleBar } from './components/TitleBar/TitleBar';
import { usePitLabStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';
import { useRelativeGapStoreUpdater } from '@irdashies/context';

export const Relative = () => {
  const settings = useRelativeSettings();
  const buffer = settings?.buffer ?? 3;
  const { isDriving } = useDrivingState();
  const standings = useDriverRelatives({ buffer });
  const [parent] = useAutoAnimate();
  const activeDrivers = useDriverStandings();
  const isMultiClass = useMemo(() => {
    const uniqueClasses = new Set(activeDrivers.flatMap(([, drivers]) => drivers.map(d => d.carClass.id)));
    return uniqueClasses.size > 1;
  }, [activeDrivers]);


  // Update relative gap store with telemetry data
  useRelativeGapStoreUpdater();
  usePitLabStoreUpdater();

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
        <DriverInfoRow
          key={`empty-${index}`}
          carIdx={0}
          classColor={0}
          name="Franz Hermann"
          isPlayer={false}
          hasFastestTime={false}
          hidden={true}
          isMultiClass={false}
          displayOrder={settings?.displayOrder}
          config={settings}
          carNumber={settings?.carNumber?.enabled ?? true ? '' : undefined}
          flairId={settings?.countryFlags?.enabled ?? true ? 0 : undefined}
          carId={settings?.carManufacturer?.enabled ?? true ? 0 : undefined}
          badge={settings?.badge?.enabled ? <></> : undefined}
          currentSessionType=""
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={undefined} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ? 0 : undefined}
          fastestTime={settings?.fastestTime?.enabled ? undefined : undefined}
          lastTime={settings?.lastTime?.enabled ? undefined : undefined}
          lastTimeState={settings?.lastTime?.enabled ? undefined : undefined}
          position={settings?.position ? undefined : undefined}
          onPitRoad={false}
          onTrack={true}
          radioActive={false}
          tireCompound={settings?.compound?.enabled ? 0 : undefined}
        />
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
        return (
          <DriverInfoRow
            key={`placeholder-${index}`}
            carIdx={0}
            classColor={0}
            name="Franz Hermann"
            isPlayer={false}
            hasFastestTime={false}
            hidden={true}
            isMultiClass={false}
            displayOrder={settings?.displayOrder}
            config={settings}
            carNumber={settings?.carNumber?.enabled ?? true ? '' : undefined}
            flairId={settings?.countryFlags?.enabled ?? true ? 0 : undefined}
            carId={settings?.carManufacturer?.enabled ?? true ? 0 : undefined}
            badge={settings?.badge?.enabled ? <></> : undefined}
            currentSessionType=""
            iratingChange={
              settings?.iratingChange?.enabled ? (
                <RatingChange value={undefined} />
              ) : undefined
            }
            delta={settings?.delta?.enabled ? 0 : undefined}
            fastestTime={settings?.fastestTime?.enabled ? undefined : undefined}
            lastTime={settings?.lastTime?.enabled ? undefined : undefined}
            lastTimeState={settings?.lastTime?.enabled ? undefined : undefined}
            position={settings?.position ? undefined : undefined}
            onPitRoad={false}
            onTrack={true}
            radioActive={false}
            tireCompound={settings?.compound?.enabled ? 0 : undefined}
            lastLap={undefined}
          />
        );
      }

      return (
        <DriverInfoRow
          key={result.carIdx}
          carIdx={ result.carIdx}
          classColor={result.carClass.color}
          carNumber={settings?.carNumber?.enabled ?? true ? result.driver?.carNum || '' : undefined}
          name={result.driver?.name || ''}
          isPlayer={result.isPlayer}
          hasFastestTime={result.hasFastestTime}
          position={result.classPosition}
          onPitRoad={result.onPitRoad}
          onTrack={result.onTrack}
          radioActive={result.radioActive}
          isLapped={result.lappedState === 'behind'}
          isLappingAhead={result.lappedState === 'ahead'}
          flairId={settings?.countryFlags?.enabled ?? true ? result.driver?.flairId : undefined}
          lastTime={settings?.lastTime?.enabled ? result.lastTime : undefined}
          fastestTime={settings?.fastestTime?.enabled ? result.fastestTime : undefined}
          lastTimeState={settings?.lastTime?.enabled ? result.lastTimeState : undefined}
          tireCompound={settings?.compound?.enabled ? result.tireCompound : undefined}
          carId={result.carId}
          lastPitLap={result.lastPitLap}
          lastLap={result.lastLap}
          carTrackSurface={result.carTrackSurface}
          prevCarTrackSurface={result.prevCarTrackSurface}
          isMultiClass={isMultiClass}
          currentSessionType={result.currentSessionType}
          badge={
            settings?.badge?.enabled ? (
              <DriverRatingBadge
                license={result.driver?.license}
                rating={result.driver?.rating}
              />
            ) : undefined
          }
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={result.iratingChange} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ? result.delta : undefined}
          displayOrder={settings?.displayOrder}
          config={settings}
        />
      );
    });
  }, [standings, playerIndex, totalRows, settings, isMultiClass]);

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  // If no player found, render empty table with consistent height
  if (playerIndex === -1) {
    return (
      <div className="w-full h-full">
        <TitleBar titleBarSettings={settings?.titleBar} />
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
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 0}%`,
      }}
    >
      <TitleBar titleBarSettings={settings?.titleBar} />
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3">
        <tbody ref={parent}>{rows}</tbody>
      </table>
      <SessionFooter />
    </div>
  );
};
