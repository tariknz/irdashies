import { Meta, StoryObj } from '@storybook/react-vite';
import { Standings } from './Standings';
import { TelemetryDecorator, DynamicTelemetrySelector } from '@irdashies/storybook';
import { useState, Fragment } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverClassHeader } from './components/DriverClassHeader/DriverClassHeader';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { RatingChange } from './components/RatingChange/RatingChange';
import { TitleBar } from './components/TitleBar/TitleBar';
import {
  useCarClassStats,
  useDriverStandings,
  useStandingsSettings,
  useHighlightColor,
} from './hooks';
import { useLapTimesStoreUpdater } from '../../context/LapTimesStore/LapTimesStoreUpdater';
import { usePitLabStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';
import { useDrivingState, useWeekendInfoNumCarClasses } from '@irdashies/context';

// Custom component that renders standings without header/footer session bars
const StandingsWithoutHeaderFooter = () => {
  const [parent] = useAutoAnimate();
  const settings = useStandingsSettings();
  const { isDriving } = useDrivingState();

  // Update lap times store with telemetry data (only for this overlay)
  useLapTimesStoreUpdater();

  // Update pit laps
  usePitLabStoreUpdater();

  const standings = useDriverStandings(settings);
  const classStats = useCarClassStats();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;
  const highlightColor = useHighlightColor();

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
      {/* No SessionBar here */}
      <table className="w-full table-auto text-sm border-separate">
        <tbody ref={parent}>
          {standings.map(([classId, classStandings]) => (
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
                    isPlayer={result.isPlayer}
                    hasFastestTime={result.hasFastestTime}
                    delta={settings?.delta?.enabled ? result.delta : undefined}
                    gap={settings?.gap?.enabled ? result.gap : undefined}
                    interval={settings?.interval?.enabled ? result.interval : undefined}
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
                    lastLap={result.lastLap}
                    carTrackSurface={result.carTrackSurface}
                    prevCarTrackSurface={result.prevCarTrackSurface}
                    badge={
                      settings?.badge?.enabled ? (
                        <DriverRatingBadge
                          license={result.driver?.license}
                          rating={result.driver?.rating}
                          format={settings.badge.badgeFormat}
                        />
                      ) : undefined
                    }
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
                  />
                ))}
              </Fragment>
            ) : null
          ))}
        </tbody>
      </table>
      {/* No SessionFooter here */}
    </div>
  );
};

export default {
  component: Standings,
} as Meta;

type Story = StoryObj<typeof Standings>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const DynamicTelemetry: Story = {
  decorators: [(Story, context) => {
    const [selectedPath, setSelectedPath] = useState('/test-data/1745291694179');
    
    return (
      <>
        <DynamicTelemetrySelector
          onPathChange={setSelectedPath}
          initialPath={selectedPath}
        />
        {TelemetryDecorator(selectedPath)(Story, context)}
      </>
    );
  }],
};

export const MultiClassPCC: Story = {
  decorators: [TelemetryDecorator('/test-data/1731391056221')],
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

export const GT3Race: Story = {
  decorators: [TelemetryDecorator('/test-data/1732359661942')],
};

export const LegendsQualifying: Story = {
  decorators: [TelemetryDecorator('/test-data/1731732047131')],
};

export const TestingCustomSessionData: Story = {
  decorators: [TelemetryDecorator('/test-data/GT3 Sprint Arrays')],
};

export const PCCRaceWithMicUse: Story = {
  decorators: [TelemetryDecorator('/test-data/1733030013074')],
};

export const WithFlairs: Story = {
  decorators: [TelemetryDecorator('/test-data/1752616787255')],
};

export const Pitstops: Story = {
  decorators: [TelemetryDecorator('/test-data/1752616787255')],
};

export const SuzukaGT3EnduranceRace: Story = {
  decorators: [TelemetryDecorator('/test-data/1763227688917')],
};

export const NoHeaderFooter: Story = {
  render: () => <StandingsWithoutHeaderFooter />,
  decorators: [TelemetryDecorator()],
};
