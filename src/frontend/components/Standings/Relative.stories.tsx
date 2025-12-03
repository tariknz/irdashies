import { Meta, StoryObj } from '@storybook/react-vite';
import { Relative } from './Relative';
import {
  TelemetryDecorator,
  DynamicTelemetrySelector,
  TelemetryDecoratorWithConfig,
} from '@irdashies/storybook';
import { useState, Fragment, useMemo } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { RatingChange } from './components/RatingChange/RatingChange';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';
import { TitleBar } from './components/TitleBar/TitleBar';
import { useDrivingState } from '@irdashies/context';
import { useRelativeSettings, useDriverRelatives, useHighlightColor } from './hooks';
import { usePitLabStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';
import { useRelativeGapStoreUpdater } from '@irdashies/context';
import { useWeekendInfoNumCarClasses } from '@irdashies/context';

// Custom component that renders relative standings without header/footer session bars
const RelativeWithoutHeaderFooter = () => {
  const settings = useRelativeSettings();
  const buffer = settings?.buffer ?? 3;
  const { isDriving } = useDrivingState();
  const standings = useDriverRelatives({ buffer });
  const [parent] = useAutoAnimate();
  const highlightColor = useHighlightColor();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;

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
          badge={settings?.badge?.enabled ? (
            <DriverRatingBadge
              license={undefined}
              rating={undefined}
              format={settings.badge.badgeFormat}
            />
          ) : undefined}
          currentSessionType=""
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={undefined} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ?? true ? 0 : undefined}
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
            delta={settings?.delta?.enabled ?? true ? 0 : undefined}
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
                format={settings.badge.badgeFormat}
              />
            ) : undefined
          }
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={result.iratingChange} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ?? true ? result.delta : undefined}
          displayOrder={settings?.displayOrder}
          config={settings}
          highlightColor={highlightColor}
          dnf={result.dnf}
          repair={result.repair}
          penalty={result.penalty}
          slowdown={result.slowdown}
        />
      );
    });
  }, [standings, playerIndex, totalRows, settings, isMultiClass, highlightColor]);

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  // If no player found, render empty table with consistent height
  if (playerIndex === -1) {
    return (
      <div className="w-full h-full">
        <TitleBar titleBarSettings={settings?.titleBar} />
        {/* No SessionBar here */}
        <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
          <tbody ref={parent}>{rows}</tbody>
        </table>
        {/* No SessionFooter here */}
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
      {/* No SessionBar here */}
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
        <tbody ref={parent}>{rows}</tbody>
      </table>
      {/* No SessionFooter here */}
    </div>
  );
};

export default {
  component: Relative,
  parameters: {
    controls: {
      exclude: ['telemetryPath'],
    },
  },
} as Meta<typeof Relative>;

type Story = StoryObj<typeof Relative>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const DynamicTelemetry: Story = {
  decorators: [
    (Story, context) => {
      const [selectedPath, setSelectedPath] = useState(
        '/test-data/1747384273173'
      );

      return (
        <>
          <DynamicTelemetrySelector
            onPathChange={setSelectedPath}
            initialPath={selectedPath}
          />
          {TelemetryDecorator(selectedPath)(Story, context)}
        </>
      );
    },
  ],
};

export const MultiClassPCCWithClio: Story = {
  decorators: [TelemetryDecorator('/test-data/1731637331038')],
};

export const SupercarsRace: Story = {
  decorators: [TelemetryDecorator('/test-data/1732274253573')],
};

export const AdvancedMX5: Story = {
  decorators: [TelemetryDecorator('/test-data/1732260478001')],
};

export const GT3Practice: Story = {
  decorators: [TelemetryDecorator('/test-data/1732355190142')],
};

export const PCCPacing: Story = {
  decorators: [TelemetryDecorator('/test-data/1735296198162')],
};

export const MultiClass: Story = {
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};

export const WithFlairs: Story = {
  decorators: [TelemetryDecorator('/test-data/1752616787255')],
};

export const WithTimesEnabled: Story = {
  decorators: [
    TelemetryDecoratorWithConfig(undefined, {
      relative: {
        lastTime: { enabled: true },
        fastestTime: { enabled: true },
      },
    }),
  ],
};

export const WithOnlyLastTimesEnabled: Story = {
  decorators: [
    TelemetryDecoratorWithConfig(undefined, {
      relative: {
        lastTime: { enabled: true },
      },
    }),
  ],
};

export const WithTyresEnabled: Story = {
  decorators: [
    TelemetryDecoratorWithConfig(undefined, {
      relative: {
        compound: { enabled: true },
      },
    }),
  ],
};

export const SuzukaGT3EnduranceRace: Story = {
  decorators: [TelemetryDecorator('/test-data/1763227688917')],
};

// Component that renders relative standings without header bar but with footer
const RelativeWithoutHeader = () => {
  const settings = useRelativeSettings();
  const buffer = settings?.buffer ?? 3;
  const { isDriving } = useDrivingState();
  const standings = useDriverRelatives({ buffer });
  const [parent] = useAutoAnimate();
  const highlightColor = useHighlightColor();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;

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
          badge={settings?.badge?.enabled ? (
            <DriverRatingBadge
              license={undefined}
              rating={undefined}
              format={settings.badge.badgeFormat}
            />
          ) : undefined}
          currentSessionType=""
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={undefined} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ?? true ? 0 : undefined}
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
            delta={settings?.delta?.enabled ?? true ? 0 : undefined}
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
                format={settings.badge.badgeFormat}
              />
            ) : undefined
          }
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={result.iratingChange} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ?? true ? result.delta : undefined}
          displayOrder={settings?.displayOrder}
          config={settings}
          highlightColor={highlightColor}
          dnf={result.dnf}
          repair={result.repair}
          penalty={result.penalty}
          slowdown={result.slowdown}
        />
      );
    });
  }, [standings, playerIndex, totalRows, settings, isMultiClass, highlightColor]);

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  // If no player found, render empty table with consistent height
  if (playerIndex === -1) {
    return (
      <div className="w-full h-full">
        <TitleBar titleBarSettings={settings?.titleBar} />
        {/* No SessionBar here */}
        <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
          <tbody ref={parent}>{rows}</tbody>
        </table>
        {/* Keep SessionFooter here */}
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
      {/* No SessionBar here */}
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
        <tbody ref={parent}>{rows}</tbody>
      </table>
      {/* Keep SessionFooter here */}
      <SessionFooter />
    </div>
  );
};

export const NoHeaderFooter: Story = {
  render: () => <RelativeWithoutHeaderFooter />,
  decorators: [TelemetryDecorator()],
};

export const NoHeader: Story = {
  render: () => <RelativeWithoutHeader />,
  decorators: [TelemetryDecorator()],
};

// Component that renders relative standings without footer but with header bar
const RelativeWithoutFooter = () => {
  const settings = useRelativeSettings();
  const buffer = settings?.buffer ?? 3;
  const { isDriving } = useDrivingState();
  const standings = useDriverRelatives({ buffer });
  const [parent] = useAutoAnimate();
  const highlightColor = useHighlightColor();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;

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
          badge={settings?.badge?.enabled ? (
            <DriverRatingBadge
              license={undefined}
              rating={undefined}
              format={settings.badge.badgeFormat}
            />
          ) : undefined}
          currentSessionType=""
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={undefined} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ?? true ? 0 : undefined}
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
            delta={settings?.delta?.enabled ?? true ? 0 : undefined}
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
                format={settings.badge.badgeFormat}
              />
            ) : undefined
          }
          iratingChange={
            settings?.iratingChange?.enabled ? (
              <RatingChange value={result.iratingChange} />
            ) : undefined
          }
          delta={settings?.delta?.enabled ?? true ? result.delta : undefined}
          displayOrder={settings?.displayOrder}
          config={settings}
          highlightColor={highlightColor}
          dnf={result.dnf}
          repair={result.repair}
          penalty={result.penalty}
          slowdown={result.slowdown}
        />
      );
    });
  }, [standings, playerIndex, totalRows, settings, isMultiClass, highlightColor]);

  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  // If no player found, render empty table with consistent height
  if (playerIndex === -1) {
    return (
      <div className="w-full h-full">
        <TitleBar titleBarSettings={settings?.titleBar} />
        {/* Keep SessionBar here */}
        <SessionBar />
        <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
          <tbody ref={parent}>{rows}</tbody>
        </table>
        {/* No SessionFooter here */}
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
      {/* Keep SessionBar here */}
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
        <tbody ref={parent}>{rows}</tbody>
      </table>
      {/* No SessionFooter here */}
    </div>
  );
};

export const NoFooter: Story = {
  render: () => <RelativeWithoutFooter />,
  decorators: [TelemetryDecorator()],
};
