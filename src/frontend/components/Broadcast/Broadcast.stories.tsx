import { Meta, StoryObj } from '@storybook/react-vite';
import { Broadcast } from './Broadcast';
import { SessionTimingStoreUpdater } from '@irdashies/context';
import {
  CaptureChannelDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';

export default {
  component: Broadcast,
  title: 'widgets/Broadcast',
} as Meta<typeof Broadcast>;

type Story = StoryObj<typeof Broadcast>;

export const Primary: Story = {
  render: () => (
    <div className="w-[280px]">
      <SessionTimingStoreUpdater enabled={true} />
      <Broadcast />
    </div>
  ),
  decorators: [
    TelemetryDecorator('/test-data/1747384033336'),
    CaptureChannelDecorator('/test-data/1747384033336'),
  ],
};
