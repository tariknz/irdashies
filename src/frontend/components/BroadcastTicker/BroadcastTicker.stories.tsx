import { Meta, StoryObj } from '@storybook/react-vite';
import { BroadcastTicker } from './BroadcastTicker';
import {
  CaptureChannelDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';

export default {
  component: BroadcastTicker,
  title: 'widgets/BroadcastTicker',
} as Meta<typeof BroadcastTicker>;

type Story = StoryObj<typeof BroadcastTicker>;

export const Primary: Story = {
  render: () => (
    <div className="h-[72px] w-[1280px]">
      <BroadcastTicker />
    </div>
  ),
  decorators: [
    TelemetryDecorator('/test-data/1747384033336'),
    CaptureChannelDecorator('/test-data/1747384033336'),
  ],
};
