import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { SessionBar } from './SessionBar';

const meta = {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar/Humidity',
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'session-bar.snapshot': {
        relativeHumidity: 0.61,
        airTemp: 24,
        trackTemp: 31,
        trackWetness: 1,
        displayUnits: 1,
        brakeBiasIsClio: false,
        incidents: 0,
        playerCarIdx: 0,
        playerClassified: true,
        playerOverallPosition: 1,
        playerClassPosition: 1,
        playerClassSize: 1,
        competitorCarIds: [],
        competitorPositions: [],
        lastLapTopSpeed: null,
        sessionBestTopSpeed: null,
        sessionNum: 0,
        version: 1,
      },
    }),
  ],
} satisfies Meta<typeof SessionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WeatherFooter: Story = {
  args: {
    settings: {
      ...getWidgetDefaultConfig('standings').footerBar,
      humidity: { enabled: true },
      displayOrder: ['airTemperature', 'humidity', 'trackTemperature'],
    },
    position: 'footer',
  },
};

export const Standalone: Story = {
  args: {
    ...WeatherFooter.args,
    standalone: true,
  },
};
