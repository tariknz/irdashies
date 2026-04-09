import { Meta, StoryObj } from '@storybook/react-vite';
import { ComponentProps } from 'react';
import { SessionBar } from '../Standings/components/SessionBar/SessionBar';
import { TelemetryDecorator } from '@irdashies/storybook';
import { SessionBarConfig } from '@irdashies/types';

/**
 * InformationBar wraps the core SessionBar logic into a standalone widget.
 * In this story, we use SessionBar directly to allow full control over settings via Storybook args.
 */
const meta: Meta = {
  title: 'widgets/InformationBar',
  component: SessionBar,
  decorators: [TelemetryDecorator()],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof SessionBar>;

/**
 * Default list of all available data cells in their standard order.
 */
const ALL_ITEMS = [
  'sessionName',
  'sessionTime',
  'sessionLaps',
  'incidentCount',
  'brakeBias',
  'localTime',
  'sessionClockTime',
  'trackWetness',
  'precipitation',
  'airTemperature',
  'trackTemperature',
  'wind',
  'trackName',
];

const DEFAULT_CONFIG: SessionBarConfig = {
  enabled: true,
  sessionName: { enabled: true },
  sessionTime: {
    enabled: true,
    mode: 'Remaining',
    totalFormat: 'minimal',
    labelStyle: 'minimal',
  },
  sessionLaps: { enabled: true, mode: 'Elapsed' },
  incidentCount: { enabled: true },
  brakeBias: { enabled: false },
  localTime: { enabled: true },
  sessionClockTime: { enabled: false },
  trackWetness: { enabled: false },
  precipitation: { enabled: false },
  airTemperature: { enabled: false, unit: 'Metric' },
  trackTemperature: { enabled: true, unit: 'Metric' },
  wind: { enabled: false, speedPosition: 'right' },
  trackName: { enabled: false },
  displayOrder: ALL_ITEMS,
};

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
