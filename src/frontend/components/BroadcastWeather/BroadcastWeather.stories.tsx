import { Meta, StoryObj } from '@storybook/react-vite';
import { BroadcastWeather } from './BroadcastWeather';
import {
  CaptureChannelDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';

export default {
  component: BroadcastWeather,
  title: 'widgets/BroadcastWeather',
} as Meta<typeof BroadcastWeather>;

type Story = StoryObj<typeof BroadcastWeather>;

export const Primary: Story = {
  render: () => (
    <div className="w-[280px]">
      <BroadcastWeather />
    </div>
  ),
  decorators: [
    TelemetryDecorator('/test-data/1747384033336'),
    CaptureChannelDecorator('/test-data/1747384033336'),
  ],
};
