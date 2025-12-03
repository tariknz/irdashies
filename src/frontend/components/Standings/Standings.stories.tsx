import { Meta, StoryObj } from '@storybook/react-vite';
import { Standings } from './Standings';
import { TelemetryDecorator, DynamicTelemetrySelector } from '@irdashies/storybook';
import { useState, Fragment } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { DriverClassHeader } from './components/DriverClassHeader/DriverClassHeader';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { RatingChange } from './components/RatingChange/RatingChange';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';
import { TitleBar } from './components/TitleBar/TitleBar';
import {
  useCarClassStats,
  useDriverStandings,
  useStandingsSettings,
  useHighlightColor,
} from './hooks';
import { useLapTimesStoreUpdater } from '../../context/LapTimesStore/LapTimesStoreUpdater';
import { usePitLabStoreUpdater } from '../../context/PitLapStore/PitLapStoreUpdater';
import { useDrivingState, useWeekendInfoNumCarClasses, useTelemetryValue, useSessionName, useSessionLaps } from '@irdashies/context';
import { useDriverIncidents, useSessionLapCount, useBrakeBias } from './hooks';
import { useCurrentTime } from './hooks/useCurrentTime';
import { useTrackWetness } from './hooks/useTrackWetness';
import { useTrackTemperature } from './hooks/useTrackTemperature';
import { formatTime } from '../../utils/time';
import { ClockIcon, DropIcon, RoadHorizonIcon, ThermometerIcon } from '@phosphor-icons/react';

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
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
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

// Component that renders standings without header bar but with footer
const StandingsWithoutHeader = () => {
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
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
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
      {/* Keep SessionFooter here */}
      <SessionFooter />
    </div>
  );
};

export const NoHeaderFooter: Story = {
  render: () => <StandingsWithoutHeaderFooter />,
  decorators: [TelemetryDecorator()],
};

export const NoHeader: Story = {
  render: () => <StandingsWithoutHeader />,
  decorators: [TelemetryDecorator()],
};

// Component that renders standings without footer but with header bar
const StandingsWithoutFooter = () => {
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
      {/* Keep SessionBar here */}
      <SessionBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
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

export const NoFooter: Story = {
  render: () => <StandingsWithoutFooter />,
  decorators: [TelemetryDecorator()],
};

// Component that shows all available header bar options
const FullHeaderBar = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionName = useSessionName(sessionNum);
  const sessionLaps = useSessionLaps(sessionNum);
  const { incidentLimit, incidents } = useDriverIncidents();
  const { total, current, timeElapsed, timeRemaining } = useSessionLapCount();
  const brakeBias = useBrakeBias();
  const time = useCurrentTime();
  const { trackWetness } = useTrackWetness();
  const { trackTemp, airTemp } = useTrackTemperature();

  return (
    <div className="bg-slate-900/70 text-sm px-3 py-1 flex justify-between mb-3">
      <div className="flex items-center gap-1">
        <span>{sessionName}</span>
      </div>
      {current > 0 && (
        <div className="flex items-center gap-1">
          <span>L {current} {total ? ` / ${total}` : ''}</span>
        </div>
      )}
      {sessionLaps == 'unlimited' && (
        <div className="flex items-center gap-1">
          <span>
            {(() => {
              const elapsed = formatTime(timeElapsed, 'duration');
              const remaining = formatTime(timeRemaining, 'duration-wlabels');
              return elapsed ? `${elapsed} / ${remaining}` : (remaining ? `${remaining}` : '');
            })()}
          </span>
        </div>
      )}
      {brakeBias && (
        <div className="flex items-center gap-1">
          <span>{brakeBias.isClio ? `BV: ${brakeBias.value.toFixed(0)}` : `BB: ${brakeBias.value.toFixed(1)}%`}</span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <span>{incidents}{incidentLimit ? ` / ${incidentLimit}` : ''} x</span>
      </div>
      <div className="flex items-center gap-1">
        <ClockIcon />
        <span>{time}</span>
      </div>
      <div className="flex items-center gap-1">
        <DropIcon />
        <span>{trackWetness}</span>
      </div>
      <div className="flex items-center gap-1">
        <ThermometerIcon />
        <span>{airTemp}</span>
      </div>
      <div className="flex items-center gap-1">
        <RoadHorizonIcon />
        <span>{trackTemp}</span>
      </div>
    </div>
  );
};

// Component that renders standings with all header bar options visible, no footer
const StandingsWithFullHeader = () => {
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
      {/* Custom full header bar */}
      <FullHeaderBar />
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
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

export const HeaderOnlyAllVisible: Story = {
  render: () => <StandingsWithFullHeader />,
  decorators: [TelemetryDecorator()],
};
