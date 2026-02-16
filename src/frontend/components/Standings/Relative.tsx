import { useMemo } from 'react';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { FlagContour } from '../../utils/FlagContour';
import {
  useDrivingState,
  useWeekendInfoNumCarClasses,
  useWeekendInfoTeamRacing,
  useSessionVisibility,
  useGeneralSettings,
  useTelemetryValue,
} from '@irdashies/context';
import {
  useRelativeSettings,
  useDriverRelatives,
  useHighlightColor,
} from './hooks';
import { SessionBar } from './components/SessionBar/SessionBar';

import { TitleBar } from './components/TitleBar/TitleBar';
import { usePitLapStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';
import { useIsSingleMake } from './hooks/useIsSingleMake';
import { getFlagColor } from '@irdashies/utils/getFlagColor';
import { getFlag } from '@irdashies/utils/getFlag';

export const Relative = () => {
  const settings = useRelativeSettings();
  const generalSettings = useGeneralSettings();
  const buffer = settings?.buffer ?? 3;
  const { isDriving } = useDrivingState();
  const standings = useDriverRelatives({ buffer });
  const highlightColor = useHighlightColor();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  usePitLapStoreUpdater();

  const isSingleMake = useIsSingleMake();
  const hideCarManufacturer = !!(
    settings?.carManufacturer?.hideIfSingleMake && isSingleMake
  );

  // Check if this is a team racing session
  const isTeamRacing = useWeekendInfoTeamRacing();

  // Get flag color for border
  const sessionFlags = useTelemetryValue<number>('SessionFlags') ?? 0;
  const flagColor = useMemo(() => {
    if (!settings?.showFlag) {
      return undefined;
    }

    const flagInfo = getFlag(sessionFlags);
    // Normalize flag label for getFlagColor (remove " FLAG" suffix, handle "NO FLAG")
    const normalizedFlagLabel = flagInfo.label.split(' ')[0];

    return getFlagColor(normalizedFlagLabel);
  }, [settings?.showFlag, sessionFlags]);
  // Determine table border spacing based on compact mode
  const tableBorderSpacing = generalSettings?.compactMode
    ? 'border-spacing-y-0'
    : 'border-spacing-y-0.5';

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
          teamName={
            settings?.teamName?.enabled && isTeamRacing ? '' : undefined
          }
          isPlayer={false}
          hasFastestTime={false}
          hidden={true}
          isMultiClass={false}
          displayOrder={settings?.displayOrder}
          config={settings}
          carNumber={(settings?.carNumber?.enabled ?? true) ? '' : undefined}
          flairId={(settings?.countryFlags?.enabled ?? true) ? 0 : undefined}
          carId={(settings?.carManufacturer?.enabled ?? true) ? 0 : undefined}
          license={undefined}
          rating={undefined}
          currentSessionType=""
          iratingChangeValue={undefined}
          delta={(settings?.delta?.enabled ?? true) ? 0 : undefined}
          fastestTime={settings?.fastestTime?.enabled ? undefined : undefined}
          lastTime={settings?.lastTime?.enabled ? undefined : undefined}
          lastTimeState={settings?.lastTime?.enabled ? undefined : undefined}
          position={settings?.position ? undefined : undefined}
          onPitRoad={false}
          onTrack={true}
          radioActive={false}
          tireCompound={settings?.compound?.enabled ? 0 : undefined}
          highlightColor={highlightColor}
          dnf={false}
          repair={false}
          penalty={false}
          slowdown={false}
          hideCarManufacturer={hideCarManufacturer}
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
            teamName={
              settings?.teamName?.enabled && isTeamRacing ? '' : undefined
            }
            isPlayer={false}
            hasFastestTime={false}
            hidden={true}
            isMultiClass={false}
            displayOrder={settings?.displayOrder}
            config={settings}
            carNumber={(settings?.carNumber?.enabled ?? true) ? '' : undefined}
            flairId={(settings?.countryFlags?.enabled ?? true) ? 0 : undefined}
            carId={(settings?.carManufacturer?.enabled ?? true) ? 0 : undefined}
            license={undefined}
            rating={undefined}
            currentSessionType=""
            iratingChangeValue={undefined}
            delta={(settings?.delta?.enabled ?? true) ? 0 : undefined}
            fastestTime={settings?.fastestTime?.enabled ? undefined : undefined}
            lastTime={settings?.lastTime?.enabled ? undefined : undefined}
            lastTimeState={settings?.lastTime?.enabled ? undefined : undefined}
            position={settings?.position ? undefined : undefined}
            onPitRoad={false}
            onTrack={true}
            radioActive={false}
            tireCompound={settings?.compound?.enabled ? 0 : undefined}
            lastLap={undefined}
            highlightColor={highlightColor}
            dnf={false}
            repair={false}
            penalty={false}
            slowdown={false}
            deltaDecimalPlaces={settings?.delta?.precision}
            hideCarManufacturer={hideCarManufacturer}
          />
        );
      }

      return (
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
          position={result.classPosition}
          lap={result.lap}
          onPitRoad={result.onPitRoad}
          onTrack={result.onTrack}
          radioActive={result.radioActive}
          isLapped={result.lappedState === 'behind'}
          isLappingAhead={result.lappedState === 'ahead'}
          flairId={
            (settings?.countryFlags?.enabled ?? true)
              ? result.driver?.flairId
              : undefined
          }
          lastTime={settings?.lastTime?.enabled ? result.lastTime : undefined}
          fastestTime={
            settings?.fastestTime?.enabled ? result.fastestTime : undefined
          }
          lastTimeState={
            settings?.lastTime?.enabled ? result.lastTimeState : undefined
          }
          tireCompound={
            settings?.compound?.enabled ? result.tireCompound : undefined
          }
          carId={result.carId}
          lastPitLap={result.lastPitLap}
          lastLap={result.lastLap}
          carTrackSurface={result.carTrackSurface}
          prevCarTrackSurface={result.prevCarTrackSurface}
          isMultiClass={isMultiClass}
          currentSessionType={result.currentSessionType}
          license={result.driver?.license}
          rating={result.driver?.rating}
          iratingChangeValue={result.iratingChange}
          delta={(settings?.delta?.enabled ?? true) ? result.delta : undefined}
          displayOrder={settings?.displayOrder}
          config={settings}
          highlightColor={highlightColor}
          dnf={result.dnf}
          repair={result.repair}
          penalty={result.penalty}
          slowdown={result.slowdown}
          deltaDecimalPlaces={settings?.delta?.precision}
          hideCarManufacturer={hideCarManufacturer}
        />
      );
    });
  }, [
    standings,
    playerIndex,
    totalRows,
    settings,
    isMultiClass,
    highlightColor,
    hideCarManufacturer,
    isTeamRacing,
  ]);

  if (!isSessionVisible) return <></>;

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  // If no player found, render empty table with consistent height
  if (playerIndex === -1) {
    return (
      <FlagContour
        compactMode={generalSettings?.compactMode}
        showFlag={settings?.showFlag}
        flagColor={flagColor}
        backgroundOpacity={0}
      >
        <TitleBar titleBarSettings={settings?.titleBar} />
        {(settings?.headerBar?.enabled ?? false) && (
          <SessionBar position="header" variant="relative" />
        )}
        <table
          className={`w-full table-auto text-sm border-separate ${tableBorderSpacing}`}
        >
          <tbody>{rows}</tbody>
        </table>
        {(settings?.footerBar?.enabled ?? true) && (
          <SessionBar position="footer" variant="relative" />
        )}
      </FlagContour>
    );
  }

  return (
    <FlagContour
      compactMode={generalSettings?.compactMode}
      showFlag={settings?.showFlag}
      flagColor={flagColor}
      backgroundOpacity={settings?.background?.opacity ?? 0}
    >
      <TitleBar titleBarSettings={settings?.titleBar} />
      {(settings?.headerBar?.enabled ?? false) && (
        <SessionBar position="header" variant="relative" />
      )}
      <table
        className={`w-full table-auto text-sm border-separate ${tableBorderSpacing}`}
      >
        <tbody>{rows}</tbody>
      </table>
      {(settings?.footerBar?.enabled ?? true) && (
        <SessionBar position="footer" variant="relative" />
      )}
    </FlagContour>
  );
};
