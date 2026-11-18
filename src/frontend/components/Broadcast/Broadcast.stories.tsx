import { Meta, StoryObj } from '@storybook/react-vite';
import { Broadcast, TowerView } from './Broadcast';
import { DEMO_GROUPS } from '@irdashies/domain/broadcast/demoField';
import { SessionTimingStoreUpdater } from '@irdashies/context';
import {
  CaptureChannelDecorator,
  ChannelSnapshotDecorator,
  sessionBarStorySnapshot,
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

const towerStory = (
  staticPage: 'gaps' | 'lastLap' | 'bestLap'
): StoryObj<typeof TowerView> => ({
  render: () => (
    <div className="w-[320px]">
      <TowerView
        settings={{ pageMode: 'static', staticPage }}
        groups={DEMO_GROUPS}
        title="Daytona"
        focusCarIdx={0}
        changes={new Map()}
        hasTyreChoice={true}
        showGrid={false}
      />
    </div>
  ),
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'session-bar.snapshot': sessionBarStorySnapshot,
    }),
  ],
});

export const Gaps = towerStory('gaps');
export const LastLap = towerStory('lastLap');
export const BestLap = towerStory('bestLap');
