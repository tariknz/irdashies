import { Meta, StoryObj } from '@storybook/react-vite';
import { Standings } from './Standings';
import {
  TelemetryDecorator,
  DynamicTelemetrySelector,
  TelemetryDecoratorWithConfig,
  mockDashboardBridge,
} from '@irdashies/storybook';
import {
  DashboardProvider,
  SessionProvider,
  TelemetryProvider,
  useLapTimesStoreUpdater,
  useLapTimesStore,
  usePitLapStoreUpdater,
  useDrivingState,
  useWeekendInfoNumCarClasses,
  useTelemetryValue,
  useSessionName,
  useSessionLaps,
} from '@irdashies/context';
import { generateMockDataFromPath } from '../../../app/bridge/iracingSdk/mock-data/generateMockData';
import type { DashboardBridge, StandingsConfig } from '@irdashies/types';
import { defaultDashboard } from '@irdashies/types';
import {
  calculateIRatingGain,
  type CalculationResult,
  type RaceResult,
} from '@irdashies/utils/iratingGain';
import { useState, useEffect, Fragment, useMemo } from 'react';
import { DriverClassHeader } from './components/DriverClassHeader/DriverClassHeader';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import type { ResolvedDriverTag } from './hooks/useDriverTagMap';
import { SessionBar } from './components/SessionBar/SessionBar';

import { TitleBar } from './components/TitleBar/TitleBar';
import {
  useCarClassStats,
  useDriverStandings,
  useStandingsSettings,
  useHighlightColor,
} from './hooks';
import { useDriverIncidents, useSessionLapCount, useBrakeBias } from './hooks';
import { useCurrentTime } from './hooks/useCurrentTime';
import { useTrackWetness } from './hooks/useTrackWetness';
import { usePrecipitation } from './hooks/usePrecipitation';
import { useTrackTemperature } from './hooks/useTrackTemperature';
import { formatTime } from '../../utils/time';
import {
  ClockIcon,
  CloudRainIcon,
  DropIcon,
  RoadHorizonIcon,
  ThermometerIcon,
  TireIcon,
} from '@phosphor-icons/react';

// Create a mock bridge with custom generalSettings for compact mode
const createMockBridgeWithCompactMode = (): DashboardBridge => ({
  ...mockDashboardBridge,
  dashboardUpdated: (callback) => {
    callback({
      ...defaultDashboard,
      generalSettings: {
        ...defaultDashboard.generalSettings,
        compactMode: 'compact',
      },
    });
    return () => {
      // No-op cleanup function
    };
  },
});

const createMockBridgeWithCompactUltraMode = (): DashboardBridge => ({
  ...mockDashboardBridge,
  dashboardUpdated: (callback) => {
    callback({
      ...defaultDashboard,
      generalSettings: {
        ...defaultDashboard.generalSettings,
        compactMode: 'ultra',
      },
    });
    return () => {
      // No-op cleanup function
    };
  },
});

// Custom component that renders standings without header/footer session bars
const StandingsWithoutHeaderFooter = () => {
  const settings = useStandingsSettings();
  const { isDriving } = useDrivingState();

  // Update lap times store with telemetry data (only for this overlay)
  useLapTimesStoreUpdater(true);

  // Update pit laps
  usePitLapStoreUpdater();

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
        <tbody>
          {standings.map(([classId, classStandings]) =>
            classStandings.length > 0 ? (
              <Fragment key={classId}>
                <DriverClassHeader
                  key={classId}
                  className={classStats?.[classId]?.shortName}
                  classColor={
                    isMultiClass ? classStats?.[classId]?.color : highlightColor
                  }
                  totalDrivers={classStats?.[classId]?.total}
                  sof={classStats?.[classId]?.sof}
                  highlightColor={highlightColor}
                  isMultiClass={isMultiClass}
                  colSpan={100}
                />
                {classStandings.map((result) => (
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
                    isPlayer={result.isPlayer}
                    hasFastestTime={result.hasFastestTime}
                    delta={settings?.delta?.enabled ? result.delta : undefined}
                    gap={settings?.gap?.enabled ? result.gap : undefined}
                    interval={
                      settings?.interval?.enabled ? result.interval : undefined
                    }
                    position={result.classPosition}
                    lap={result.lap}
                    iratingChangeValue={
                      settings?.iratingChange?.enabled
                        ? result.iratingChange
                        : undefined
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
                      settings?.lastTime?.enabled
                        ? result.lastTimeState
                        : undefined
                    }
                    onPitRoad={result.onPitRoad}
                    onTrack={result.onTrack}
                    radioActive={result.radioActive}
                    isMultiClass={isMultiClass}
                    flairId={
                      (settings?.countryFlags?.enabled ?? true)
                        ? result.driver?.flairId
                        : undefined
                    }
                    tireCompound={
                      (settings?.compound?.enabled ?? true)
                        ? result.tireCompound
                        : undefined
                    }
                    carId={result.carId}
                    lastPitLap={result.lastPitLap}
                    lastLap={result.lastLap}
                    carTrackSurface={result.carTrackSurface}
                    prevCarTrackSurface={result.prevCarTrackSurface}
                    license={
                      settings?.badge?.enabled
                        ? result.driver?.license
                        : undefined
                    }
                    rating={
                      settings?.badge?.enabled
                        ? result.driver?.rating
                        : undefined
                    }
                    lapTimeDeltas={
                      settings?.lapTimeDeltas?.enabled
                        ? result.lapTimeDeltas
                        : undefined
                    }
                    numLapDeltasToShow={
                      settings?.lapTimeDeltas?.enabled
                        ? settings.lapTimeDeltas.numLaps
                        : undefined
                    }
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
          )}
        </tbody>
      </table>
      {/* No SessionFooter here */}
    </div>
  );
};

export default {
  component: Standings,
  title: 'widgets/Standings',
} as Meta;

type Story = StoryObj<typeof Standings>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const DynamicTelemetry: Story = {
  decorators: [
    (Story, context) => {
      const [selectedPath, setSelectedPath] = useState(
        '/test-data/1745291694179'
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

export const MultiClassPCC: Story = {
  decorators: [TelemetryDecorator('/test-data/1731391056221')],
};

export const MultiClassPCCWithClio: Story = {
  decorators: [TelemetryDecorator('/test-data/1731637331038')],
};

// Component that calculates irating change for the standings (demo only)
const StandingsWithIRatingCalculation = () => {
  const settings = useStandingsSettings();
  const { isDriving } = useDrivingState();
  const standings = useDriverStandings(settings);
  const classStats = useCarClassStats();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = (numCarClasses ?? 0) > 1;
  const highlightColor = useHighlightColor();

  useLapTimesStoreUpdater(true);
  usePitLapStoreUpdater();

  // Manually apply irating calculation for demo purposes
  const standingsWithIRating = useMemo(() => {
    const grouped = standings.map(([classId, classStandings]) => {
      const raceResultsInput: RaceResult<number>[] = classStandings
        .filter((s) => !!s.classPosition)
        .map((driverStanding) => ({
          driver: driverStanding.carIdx,
          finishRank: driverStanding.classPosition ?? 0,
          startIRating: driverStanding.driver.rating,
          started: true,
        }));

      if (raceResultsInput.length === 0) {
        return [classId, classStandings] as [string, typeof classStandings];
      }

      const iratingResults = calculateIRatingGain(raceResultsInput);
      const iratingMap = new Map<number, number>();
      iratingResults.forEach((result: CalculationResult<number>) => {
        iratingMap.set(result.raceResult.driver, result.iratingChange);
      });

      const augmented = classStandings.map((s) => ({
        ...s,
        iratingChange: iratingMap.get(s.carIdx),
      }));
      return [classId, augmented] as [string, typeof augmented];
    });
    return grouped;
  }, [standings]);

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
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
        <tbody>
          {standingsWithIRating.map(([classId, classStandings]) =>
            classStandings.length > 0 ? (
              <Fragment key={classId}>
                <DriverClassHeader
                  key={classId}
                  className={classStats?.[classId]?.shortName}
                  classColor={
                    isMultiClass ? classStats?.[classId]?.color : highlightColor
                  }
                  totalDrivers={classStats?.[classId]?.total}
                  sof={classStats?.[classId]?.sof}
                  highlightColor={highlightColor}
                  isMultiClass={isMultiClass}
                  colSpan={100}
                />
                {classStandings.map((result) => (
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
                    isPlayer={result.isPlayer}
                    hasFastestTime={result.hasFastestTime}
                    delta={settings?.delta?.enabled ? result.delta : undefined}
                    gap={settings?.gap?.enabled ? result.gap : undefined}
                    interval={
                      settings?.interval?.enabled ? result.interval : undefined
                    }
                    position={result.classPosition}
                    lap={result.lap}
                    iratingChangeValue={
                      settings?.iratingChange?.enabled
                        ? result.iratingChange
                        : undefined
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
                      settings?.lastTime?.enabled
                        ? result.lastTimeState
                        : undefined
                    }
                    onPitRoad={result.onPitRoad}
                    onTrack={result.onTrack}
                    radioActive={result.radioActive}
                    isMultiClass={isMultiClass}
                    flairId={
                      (settings?.countryFlags?.enabled ?? true)
                        ? result.driver?.flairId
                        : undefined
                    }
                    tireCompound={
                      (settings?.compound?.enabled ?? true)
                        ? result.tireCompound
                        : undefined
                    }
                    carId={result.carId}
                    lastPitLap={result.lastPitLap}
                    lastLap={result.lastLap}
                    carTrackSurface={result.carTrackSurface}
                    prevCarTrackSurface={result.prevCarTrackSurface}
                    license={
                      settings?.badge?.enabled
                        ? result.driver?.license
                        : undefined
                    }
                    rating={
                      settings?.badge?.enabled
                        ? result.driver?.rating
                        : undefined
                    }
                    lapTimeDeltas={
                      settings?.lapTimeDeltas?.enabled
                        ? result.lapTimeDeltas
                        : undefined
                    }
                    numLapDeltasToShow={
                      settings?.lapTimeDeltas?.enabled
                        ? settings.lapTimeDeltas.numLaps
                        : undefined
                    }
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
          )}
        </tbody>
      </table>
    </div>
  );
};

export const MultiClassPlayground: Story = {
  argTypes: {
    numNonClassDrivers: {
      control: { type: 'number', min: 0, max: 10 },
      name: 'Drivers from other classes',
    },
    numTopDrivers: {
      control: { type: 'number', min: 0, max: 10 },
      name: "Top drivers to always show in player's class",
    },
  },
  args: {
    numNonClassDrivers: 3,
    numTopDrivers: 3,
  },
  render: () => <StandingsWithIRatingCalculation />,
  decorators: [
    (Story, context) => {
      const { numNonClassDrivers, numTopDrivers } = context.args as {
        numNonClassDrivers: number;
        numTopDrivers: number;
      };
      const standingsConfig = defaultDashboard.widgets.find(
        (w) => w.id === 'standings'
      )?.config as StandingsConfig;

      return TelemetryDecoratorWithConfig('/test-data/1731637331038', {
        standings: {
          ...standingsConfig,
          iratingChange: { enabled: true },
          driverStandings: {
            ...standingsConfig?.driverStandings,
            numNonClassDrivers,
            numTopDrivers,
          },
        },
      })(Story, context);
    },
  ],
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

export const HeatRaceFormatRaceStart: Story = {
  decorators: [TelemetryDecorator('/test-data/1772788167371')],
};

export const TeamSession: Story = {
  decorators: [
    TelemetryDecoratorWithConfig('/test-data/1763227688917', {
      standings: {
        teamName: { enabled: true },
        displayOrder: [
          'position',
          'carNumber',
          'countryFlags',
          'badge',
          'teamName',
          'driverName',
          'pitStatus',
          'carManufacturer',
          'compound',
          'iratingChange',
          'gap',
          'interval',
          'fastestTime',
          'lastTime',
          'lapTimeDeltas',
        ],
      },
    }),
  ],
};

// Component that renders standings without header bar but with footer
const StandingsWithoutHeader = () => {
  const settings = useStandingsSettings();
  const { isDriving } = useDrivingState();

  // Update lap times store with telemetry data (only for this overlay)
  useLapTimesStoreUpdater(true);

  // Update pit laps
  usePitLapStoreUpdater();

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
        <tbody>
          {standings.map(([classId, classStandings]) =>
            classStandings.length > 0 ? (
              <Fragment key={classId}>
                <DriverClassHeader
                  key={classId}
                  className={classStats?.[classId]?.shortName}
                  classColor={
                    isMultiClass ? classStats?.[classId]?.color : highlightColor
                  }
                  totalDrivers={classStats?.[classId]?.total}
                  sof={classStats?.[classId]?.sof}
                  highlightColor={highlightColor}
                  isMultiClass={isMultiClass}
                  colSpan={100}
                />
                {classStandings.map((result) => (
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
                    isPlayer={result.isPlayer}
                    hasFastestTime={result.hasFastestTime}
                    delta={settings?.delta?.enabled ? result.delta : undefined}
                    gap={settings?.gap?.enabled ? result.gap : undefined}
                    interval={
                      settings?.interval?.enabled ? result.interval : undefined
                    }
                    position={result.classPosition}
                    lap={result.lap}
                    iratingChangeValue={
                      settings?.iratingChange?.enabled
                        ? result.iratingChange
                        : undefined
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
                      settings?.lastTime?.enabled
                        ? result.lastTimeState
                        : undefined
                    }
                    onPitRoad={result.onPitRoad}
                    onTrack={result.onTrack}
                    radioActive={result.radioActive}
                    isMultiClass={isMultiClass}
                    flairId={
                      (settings?.countryFlags?.enabled ?? true)
                        ? result.driver?.flairId
                        : undefined
                    }
                    tireCompound={
                      (settings?.compound?.enabled ?? true)
                        ? result.tireCompound
                        : undefined
                    }
                    carId={result.carId}
                    lastPitLap={result.lastPitLap}
                    lastLap={result.lastLap}
                    carTrackSurface={result.carTrackSurface}
                    prevCarTrackSurface={result.prevCarTrackSurface}
                    license={
                      settings?.badge?.enabled
                        ? result.driver?.license
                        : undefined
                    }
                    rating={
                      settings?.badge?.enabled
                        ? result.driver?.rating
                        : undefined
                    }
                    lapTimeDeltas={
                      settings?.lapTimeDeltas?.enabled
                        ? result.lapTimeDeltas
                        : undefined
                    }
                    numLapDeltasToShow={
                      settings?.lapTimeDeltas?.enabled
                        ? settings.lapTimeDeltas.numLaps
                        : undefined
                    }
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
          )}
        </tbody>
      </table>
      {/* Keep SessionBar here */}
      {settings?.footerBar && (
        <SessionBar settings={settings.footerBar} position="footer" />
      )}
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
  const settings = useStandingsSettings();
  const { isDriving } = useDrivingState();

  // Update lap times store with telemetry data (only for this overlay)
  useLapTimesStoreUpdater(true);

  // Update pit laps
  usePitLapStoreUpdater();

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
      {settings?.headerBar && (
        <SessionBar settings={settings.headerBar} position="header" />
      )}
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
        <tbody>
          {standings.map(([classId, classStandings]) =>
            classStandings.length > 0 ? (
              <Fragment key={classId}>
                <DriverClassHeader
                  key={classId}
                  className={classStats?.[classId]?.shortName}
                  classColor={
                    isMultiClass ? classStats?.[classId]?.color : highlightColor
                  }
                  totalDrivers={classStats?.[classId]?.total}
                  sof={classStats?.[classId]?.sof}
                  highlightColor={highlightColor}
                  isMultiClass={isMultiClass}
                  colSpan={100}
                />
                {classStandings.map((result) => (
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
                    isPlayer={result.isPlayer}
                    hasFastestTime={result.hasFastestTime}
                    delta={settings?.delta?.enabled ? result.delta : undefined}
                    gap={settings?.gap?.enabled ? result.gap : undefined}
                    interval={
                      settings?.interval?.enabled ? result.interval : undefined
                    }
                    position={result.classPosition}
                    lap={result.lap}
                    iratingChangeValue={
                      settings?.iratingChange?.enabled
                        ? result.iratingChange
                        : undefined
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
                      settings?.lastTime?.enabled
                        ? result.lastTimeState
                        : undefined
                    }
                    onPitRoad={result.onPitRoad}
                    onTrack={result.onTrack}
                    radioActive={result.radioActive}
                    isMultiClass={isMultiClass}
                    flairId={
                      (settings?.countryFlags?.enabled ?? true)
                        ? result.driver?.flairId
                        : undefined
                    }
                    tireCompound={
                      (settings?.compound?.enabled ?? true)
                        ? result.tireCompound
                        : undefined
                    }
                    carId={result.carId}
                    lastPitLap={result.lastPitLap}
                    lastLap={result.lastLap}
                    carTrackSurface={result.carTrackSurface}
                    prevCarTrackSurface={result.prevCarTrackSurface}
                    license={
                      settings?.badge?.enabled
                        ? result.driver?.license
                        : undefined
                    }
                    rating={
                      settings?.badge?.enabled
                        ? result.driver?.rating
                        : undefined
                    }
                    lapTimeDeltas={
                      settings?.lapTimeDeltas?.enabled
                        ? result.lapTimeDeltas
                        : undefined
                    }
                    numLapDeltasToShow={
                      settings?.lapTimeDeltas?.enabled
                        ? settings.lapTimeDeltas.numLaps
                        : undefined
                    }
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
          )}
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
  const { currentLap, totalLaps, timeTotal, timeRemaining } =
    useSessionLapCount();
  const brakeBias = useBrakeBias();
  const localTime = useCurrentTime();
  const { trackWetness } = useTrackWetness();
  const { precipitation } = usePrecipitation();
  const { trackTemp, airTemp } = useTrackTemperature();

  return (
    <div className="bg-slate-900/70 text-sm px-3 py-1 flex justify-between mb-3">
      <div className="flex items-center gap-1">
        <span>{sessionName}</span>
      </div>
      {currentLap > 0 && (
        <div className="flex items-center gap-1">
          <span>
            L {currentLap} {totalLaps ? ` / ${totalLaps}` : ''}
          </span>
        </div>
      )}
      {sessionLaps == 'unlimited' && (
        <div className="flex items-center gap-1">
          <span>
            {(() => {
              const mode = 'Elapsed';

              const elapsedTime = Math.max(0, timeTotal - timeRemaining);
              const remainingTime = Math.max(0, timeRemaining);
              const totalTime = timeTotal;

              const elapsedStr =
                elapsedTime < totalTime
                  ? formatTime(elapsedTime, 'duration')
                  : null;
              const remainingStr =
                remainingTime < totalTime
                  ? formatTime(remainingTime, 'duration')
                  : null;
              const totalStr = formatTime(totalTime, 'duration-wlabels');

              let timeStr = '';
              if (mode === 'Elapsed') {
                timeStr = elapsedStr
                  ? `${elapsedStr} / ${totalStr}`
                  : totalStr || '';
              } else if (mode === 'Remaining') {
                timeStr = remainingStr
                  ? `${remainingStr} / ${totalStr}`
                  : totalStr || '';
              }

              return timeStr ? (
                <div className="flex justify-center">{timeStr}</div>
              ) : null;
            })()}
          </span>
        </div>
      )}
      {brakeBias && (
        <div className="flex items-center gap-1">
          <TireIcon />
          <span>
            {brakeBias.isClio
              ? `${brakeBias.value.toFixed(0)}`
              : `${brakeBias.value.toFixed(1)}%`}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <span>
          {incidents}
          {incidentLimit ? ` / ${incidentLimit}` : ''} x
        </span>
      </div>
      <div className="flex items-center gap-1">
        <ClockIcon />
        <span>{localTime}</span>
      </div>
      <div className="flex items-center gap-1">
        <DropIcon />
        <span>{trackWetness}</span>
      </div>
      <div className="flex items-center gap-1">
        <CloudRainIcon />
        <span>{precipitation}</span>
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
  const settings = useStandingsSettings();
  const { isDriving } = useDrivingState();

  // Update lap times store with telemetry data (only for this overlay)
  useLapTimesStoreUpdater(true);

  // Update pit laps
  usePitLapStoreUpdater();

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
        <tbody>
          {standings.map(([classId, classStandings]) =>
            classStandings.length > 0 ? (
              <Fragment key={classId}>
                <DriverClassHeader
                  key={classId}
                  className={classStats?.[classId]?.shortName}
                  classColor={
                    isMultiClass ? classStats?.[classId]?.color : highlightColor
                  }
                  totalDrivers={classStats?.[classId]?.total}
                  sof={classStats?.[classId]?.sof}
                  highlightColor={highlightColor}
                  isMultiClass={isMultiClass}
                  colSpan={100}
                />
                {classStandings.map((result) => (
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
                    isPlayer={result.isPlayer}
                    hasFastestTime={result.hasFastestTime}
                    delta={settings?.delta?.enabled ? result.delta : undefined}
                    gap={settings?.gap?.enabled ? result.gap : undefined}
                    interval={
                      settings?.interval?.enabled ? result.interval : undefined
                    }
                    position={result.classPosition}
                    lap={result.lap}
                    iratingChangeValue={
                      settings?.iratingChange?.enabled
                        ? result.iratingChange
                        : undefined
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
                      settings?.lastTime?.enabled
                        ? result.lastTimeState
                        : undefined
                    }
                    onPitRoad={result.onPitRoad}
                    onTrack={result.onTrack}
                    radioActive={result.radioActive}
                    isMultiClass={isMultiClass}
                    flairId={
                      (settings?.countryFlags?.enabled ?? true)
                        ? result.driver?.flairId
                        : undefined
                    }
                    tireCompound={
                      (settings?.compound?.enabled ?? true)
                        ? result.tireCompound
                        : undefined
                    }
                    carId={result.carId}
                    lastPitLap={result.lastPitLap}
                    lastLap={result.lastLap}
                    carTrackSurface={result.carTrackSurface}
                    prevCarTrackSurface={result.prevCarTrackSurface}
                    license={
                      settings?.badge?.enabled
                        ? result.driver?.license
                        : undefined
                    }
                    rating={
                      settings?.badge?.enabled
                        ? result.driver?.rating
                        : undefined
                    }
                    lapTimeDeltas={
                      settings?.lapTimeDeltas?.enabled
                        ? result.lapTimeDeltas
                        : undefined
                    }
                    numLapDeltasToShow={
                      settings?.lapTimeDeltas?.enabled
                        ? settings.lapTimeDeltas.numLaps
                        : undefined
                    }
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
          )}
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

export const CompactMode: Story = {
  decorators: [
    (Story) => (
      <>
        <SessionProvider bridge={generateMockDataFromPath()} />
        <TelemetryProvider bridge={generateMockDataFromPath()} />
        <DashboardProvider bridge={createMockBridgeWithCompactMode()}>
          <Story />
        </DashboardProvider>
      </>
    ),
  ],
};

export const CompactUltraMode: Story = {
  decorators: [
    (Story) => (
      <>
        <SessionProvider bridge={generateMockDataFromPath()} />
        <TelemetryProvider bridge={generateMockDataFromPath()} />
        <DashboardProvider bridge={createMockBridgeWithCompactUltraMode()}>
          <Story />
        </DashboardProvider>
      </>
    ),
  ],
};

export const PositionDividerHighlight: Story = {
  name: 'Position Divider (Highlight)',
  decorators: [
    TelemetryDecoratorWithConfig('/test-data/1732355190142', {
      standings: {
        driverStandings: {
          numTopDrivers: 3,
          topDriverDivider: 'highlight',
        },
      },
    }),
  ],
};

export const PositionDividerTheme: Story = {
  name: 'Position Divider (Theme)',
  decorators: [
    TelemetryDecoratorWithConfig('/test-data/1731637331038', {
      standings: {
        driverStandings: {
          numTopDrivers: 3,
          topDriverDivider: 'theme',
        },
      },
    }),
  ],
};

export const PositionDividerNone: Story = {
  name: 'Position Divider (None)',
  decorators: [
    TelemetryDecoratorWithConfig('/test-data/1731637331038', {
      standings: {
        driverStandings: {
          numTopDrivers: 3,
          topDriverDivider: 'none',
        },
      },
    }),
  ],
};

export const PositionDividerNumerousCells: Story = {
  name: 'Position Divider (Numerous Cells)',
  decorators: [
    TelemetryDecoratorWithConfig('/test-data/1731637331038', {
      standings: {
        driverStandings: {
          numTopDrivers: 3,
          topDriverDivider: 'highlight',
        },
        gap: { enabled: true },
        delta: { enabled: true },
        interval: { enabled: true },
        lastTime: { enabled: true },
        fastestTime: { enabled: true },
        lapTimeDeltas: { enabled: true, numLaps: 3 },
        badge: { enabled: true },
        iratingChange: { enabled: true },
      },
    }),
  ],
};

export const MinimalStyling: Story = {
  decorators: [
    TelemetryDecoratorWithConfig('/test-data/1731637331038', {
      standings: {
        badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
        stylingOptions: {
          badge: true,
          statusBadges: true,
          driverPosition: { background: false },
          driverNumber: { background: false, border: true },
        },
        classHeaderStyle: {
          className: { colorBackground: false },
          classInfo: { colorBackground: false },
          classDivider: { bottomBorder: true },
        },
      },
    }),
  ],
};

const singleDriverTag: ResolvedDriverTag = {
  id: 'friend',
  name: 'Friend',
  icon: 'Star',
  color: 0xffff00,
};

const SingleDriverWithTagComponent = () => (
  <div className="w-full bg-slate-800/70 rounded-sm p-2 text-white">
    <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
      <tbody>
        <DriverInfoRow
          carIdx={1}
          carNumber="99"
          classColor={0xff5888}
          name="Jane Smith"
          isPlayer={false}
          hasFastestTime={false}
          delta={0.5}
          position={1}
          lap={5}
          license="A 4.99"
          rating={4999}
          onPitRoad={false}
          onTrack={true}
          radioActive={false}
          isMultiClass={false}
          flairId={223}
          tireCompound={1}
          carId={122}
          currentSessionType="Race"
          dnf={false}
          repair={false}
          penalty={false}
          slowdown={false}
          resolvedTag={singleDriverTag}
          hasAnyDriverTag={true}
          config={
            {
              badge: { enabled: true, badgeFormat: 'license-color-rating-bw' },
            } as import('@irdashies/types').StandingsWidgetSettings['config']
          }
        />
      </tbody>
    </table>
  </div>
);

export const SingleDriverWithTag: Story = {
  decorators: [TelemetryDecorator()],
  render: () => <SingleDriverWithTagComponent />,
  parameters: {
    layout: 'padded',
  },
};

// Demo lap times per carIdx: [baseLapTime, variance] in seconds
// Matches carIdx slots used in default mock data (cars at indices 0–5)
const DEMO_LAP_TIMES: Record<number, number> = {
  0: 92.4,
  1: 93.1,
  2: 91.8,
  3: 94.2,
  4: 92.9,
  5: 93.7,
};

const NUM_CARS = 64;

/**
 * Seeds the LapTimesStore with realistic rolling lap history for demo purposes.
 * Calls updateLapTimes 5 times with slightly varied lap times per car to simulate
 * 5 laps of history.
 */
const LapHistorySeeder = () => {
  const updateLapTimes = useLapTimesStore((s) => s.updateLapTimes);

  useEffect(() => {
    const baseTimes = Array.from({ length: NUM_CARS }, (_, idx) =>
      DEMO_LAP_TIMES[idx] !== undefined ? DEMO_LAP_TIMES[idx] : 0
    );

    // Simulate 5 completed laps by calling updateLapTimes with slightly varied
    // times. Each call must differ from the previous to be recorded as a new lap.
    const variations = [0, 0.3, -0.2, 0.5, -0.4, 0.1];
    let prev = baseTimes.map(() => -1);

    for (const variation of variations) {
      const lapTimes = baseTimes.map((base) =>
        base > 0 ? base + variation : 0
      );
      // Ensure values differ from previous call so the store records the lap
      if (lapTimes.some((t, i) => t !== prev[i] && t > 0)) {
        updateLapTimes(lapTimes, 0);
      }
      prev = lapTimes;
    }
  }, [updateLapTimes]);

  return null;
};

export const AvgLapTime: Story = {
  name: 'Avg Lap Time Column',
  render: () => (
    <>
      <LapHistorySeeder />
      <Standings />
    </>
  ),
  decorators: [
    TelemetryDecoratorWithConfig(undefined, {
      standings: {
        avgLapTime: { enabled: true, numLaps: 5, timeFormat: 'mixed' },
        lapTimeDeltas: { enabled: false, numLaps: 3 },
        displayOrder: [
          'position',
          'carNumber',
          'driverName',
          'gap',
          'interval',
          'lastTime',
          'avgLapTime',
        ],
      },
    }),
  ],
};
