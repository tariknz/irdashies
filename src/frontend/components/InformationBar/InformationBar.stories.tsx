import { Meta, StoryObj } from '@storybook/react-vite';
import { ComponentProps } from 'react';
import type { ComponentType } from 'react';
import { SessionBar } from '../Standings/components/SessionBar/SessionBar';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';
import { getWidgetDefaultConfig, SessionBarConfig } from '@irdashies/types';
import { SessionTimingStoreUpdater } from '@irdashies/context';

/**
 * InformationBar wraps the core SessionBar logic into a standalone widget.
 * In this story, we use SessionBar directly to allow full control over settings via Storybook args.
 */
const meta: Meta = {
  title: 'widgets/InformationBar',
  component: SessionBar,
  decorators: [
    (Story: ComponentType) => (
      <>
        <SessionTimingStoreUpdater enabled={true} />
        <Story />
      </>
    ),
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'session-bar.snapshot': {
        sessionName: 'Race',
        displayUnits: 1,
        brakeBiasIsClio: false,
        incidents: 2,
        trackWetness: 1,
        airTemp: 24,
        trackTemp: 31,
        playerCarIdx: 0,
        playerClassified: true,
        playerOverallPosition: 2,
        playerClassPosition: 2,
        playerClassSize: 20,
        competitorCarIds: [],
        competitorPositions: [],
        lastLapTopSpeed: null,
        sessionBestTopSpeed: null,
        sessionNum: 0,
        version: 1,
      },
      'session-timing.snapshot': {
        sessionType: 'Race',
        state: 4,
        currentLap: 8,
        totalLaps: 20,
        time: 960,
        timeTotal: 2400,
        timeRemaining: 1440,
        greenFlagTimestamp: 0,
        isFixedLapRace: true,
        totalRaceLaps: 20,
        totalRaceTime: 2400,
        adjustedRaceTime: 2400,
        sessionNum: 0,
        version: 1,
      },
    }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof SessionBar>;

/**
 * Default list of all available data cells in their standard order.
 */
const DEFAULT_CONFIG = getWidgetDefaultConfig('infobar');
const ALL_ITEMS = DEFAULT_CONFIG.displayOrder;

export const Primary: Story = {
  args: {
    settings: DEFAULT_CONFIG,
    standalone: true,
  },
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="w-full bg-slate-800/80 p-2">
      <SessionBar {...args} />
    </div>
  ),
};

type PlaygroundArgs = ComponentProps<typeof SessionBar> & {
  displayOrder: string[];
  backgroundOpacity: number;
  showSessionName: boolean;
  showSessionTime: boolean;
  showSessionLaps: boolean;
  showIncidentCount: boolean;
  showBrakeBias: boolean;
  showLocalTime: boolean;
  showSessionClockTime: boolean;
  showTrackWetness: boolean;
  showPrecipitation: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showTrackName: boolean;
  showClassRank: boolean;
  showManufacturerPosition: boolean;
  showTopSpeed: boolean;
  showBestLap: boolean;
  showLastLap: boolean;
  showFuelLevel: boolean;
};

export const Playground: StoryObj<PlaygroundArgs> = {
  argTypes: {
    settings: { table: { disable: true } },
    position: { table: { disable: true } },
    displayOrder: { table: { disable: true } },
    backgroundOpacity: { table: { disable: true } },
    standalone: { table: { disable: true } },
    // Adding individual toggles for convenience in the Playground
    showSessionName: { control: 'boolean', name: 'Session Name' },
    showSessionTime: { control: 'boolean', name: 'Session Time' },
    showSessionLaps: { control: 'boolean', name: 'Session Laps' },
    showIncidentCount: { control: 'boolean', name: 'Incident Count' },
    showBrakeBias: { control: 'boolean', name: 'Brake Bias' },
    showLocalTime: { control: 'boolean', name: 'Local Time' },
    showSessionClockTime: { control: 'boolean', name: 'Session Clock' },
    showTrackWetness: { control: 'boolean', name: 'Track Wetness' },
    showPrecipitation: { control: 'boolean', name: 'Precipitation' },
    showAirTemp: { control: 'boolean', name: 'Air Temp' },
    showTrackTemp: { control: 'boolean', name: 'Track Temp' },
    showWind: { control: 'boolean', name: 'Wind' },
    showTrackName: { control: 'boolean', name: 'Track Name' },
    showClassRank: { control: 'boolean', name: 'Class Rank' },
    showManufacturerPosition: {
      control: 'boolean',
      name: 'Manufacturer Position',
    },
    showTopSpeed: { control: 'boolean', name: 'Top Speed' },
    showBestLap: { control: 'boolean', name: 'Best Lap' },
    showLastLap: { control: 'boolean', name: 'Last Lap' },
    showFuelLevel: { control: 'boolean', name: 'Fuel Level' },
  },
  args: {
    settings: DEFAULT_CONFIG, // Base settings, will be partially overridden by toggles
    backgroundOpacity: 90,
    displayOrder: ALL_ITEMS,
    showSessionName: true,
    showSessionTime: true,
    showSessionLaps: true,
    showIncidentCount: true,
    showBrakeBias: true,
    showLocalTime: true,
    showSessionClockTime: false,
    showTrackWetness: true,
    showPrecipitation: false,
    showAirTemp: true,
    showTrackTemp: true,
    showWind: false,
    showTrackName: false,
    showClassRank: false,
    showManufacturerPosition: false,
    showTopSpeed: false,
    showBestLap: false,
    showLastLap: false,
    showFuelLevel: false,
  },
  render: (args) => {
    const config: SessionBarConfig = {
      ...DEFAULT_CONFIG,
      displayOrder: args.displayOrder,
      sessionName: { enabled: args.showSessionName },
      sessionTime: {
        ...DEFAULT_CONFIG.sessionTime,
        enabled: args.showSessionTime,
      },
      sessionLaps: {
        ...DEFAULT_CONFIG.sessionLaps,
        enabled: args.showSessionLaps,
      },
      incidentCount: { enabled: args.showIncidentCount },
      brakeBias: { enabled: args.showBrakeBias },
      localTime: { enabled: args.showLocalTime },
      sessionClockTime: { enabled: args.showSessionClockTime },
      trackWetness: { enabled: args.showTrackWetness },
      precipitation: {
        enabled: args.showPrecipitation,
      },
      airTemperature: {
        ...DEFAULT_CONFIG.airTemperature,
        enabled: args.showAirTemp,
      },
      trackTemperature: {
        ...DEFAULT_CONFIG.trackTemperature,
        enabled: args.showTrackTemp,
      },
      wind: DEFAULT_CONFIG.wind
        ? { ...DEFAULT_CONFIG.wind, enabled: args.showWind }
        : undefined,
      trackName: { enabled: args.showTrackName },
      classRank: { enabled: args.showClassRank },
      manufacturerPosition: { enabled: args.showManufacturerPosition },
      topSpeed: { enabled: args.showTopSpeed },
      bestLap: { enabled: args.showBestLap },
      lastLap: { enabled: args.showLastLap },
      fuelLevel: { enabled: args.showFuelLevel },
    };

    return (
      <div
        className="w-full bg-slate-800 rounded-sm p-2"
        style={{ opacity: args.backgroundOpacity / 100 }}
      >
        <SessionBar settings={config} standalone />
      </div>
    );
  },
};

/** Final session-bar checkpoint from the curated Road America telemetry tape. */
export const AdditionalItems: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': {
        sessionName: 'Race',
        trackDisplayName: 'Road America',
        displayUnits: 1,
        brakeBias: 51,
        brakeBiasIsClio: false,
        incidents: 2,
        incidentLimit: 25,
        incidentWarningInitialLimit: 17,
        incidentWarningSubsequentLimit: 17,
        trackWetness: 1,
        precipitation: 0,
        relativeHumidity: 0.6811820864677429,
        airTemp: 24.844425201416016,
        trackTemp: 43.888885498046875,
        windDirection: 0.05303299427032471,
        windVelocity: 4.85117244720459,
        windYaw: 3.1238932609558105,
        fuelLevel: 34.32027053833008,
        lastLapTime: 129.2841033935547,
        bestLapTime: 129.2841033935547,
        sessionBestLap: 119.54869842529297,
        sessionTimeOfDay: 53490,
        playerCarIdx: 0,
        playerCarId: 132,
        playerClassified: true,
        playerOverallPosition: 27,
        playerClassPosition: 1,
        playerClassSize: 14,
        competitorCarIds: [
          132, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128,
          132, 133, 133, 156, 169, 169, 173, 184, 185, 188, 194, 206, 206, 159,
          159, 168, 168, 168, 170, 170, 170, 174, 174, 174, 196, 196,
        ],
        competitorPositions: [
          27, 12, 18, 23, 14, 25, 24, 11, 22, 20, 26, 21, 17, 13, 37, 32, 34,
          38, 33, 29, 40, 36, 35, 28, 30, 39, 31, 16, 7, 15, 1, 2, 3, 6, 4, 10,
          8, 9, 19, 5,
        ],
        lastLapTopSpeed: 71.87733459472656,
        sessionBestTopSpeed: 71.92219543457031,
        sessionNum: 0,
        version: 2999,
      },
    }),
  ],
  args: {
    settings: {
      ...DEFAULT_CONFIG,
      fuelLevel: { enabled: true },
      lastLap: { enabled: true },
      bestLap: { enabled: true },
      topSpeed: { enabled: true },
      manufacturerPosition: { enabled: true },
      classRank: { enabled: true },
      displayOrder: [
        'fuelLevel',
        'lastLap',
        'bestLap',
        'topSpeed',
        'manufacturerPosition',
        'classRank',
      ],
    },
    standalone: true,
  },
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="w-full bg-slate-800/80 p-2">
      <SessionBar {...args} />
    </div>
  ),
};
