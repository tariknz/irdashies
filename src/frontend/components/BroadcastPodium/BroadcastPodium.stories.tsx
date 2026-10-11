import type { ComponentType } from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { DEMO_GROUPS as groups } from '@irdashies/domain/broadcast/demoField';
import {
  CaptureChannelDecorator,
  TelemetryDecorator,
  mockDashboardBridge,
} from '@irdashies/storybook';
import { BroadcastPodium } from './BroadcastPodium';
import { PodiumCard } from './PodiumCard';

export default {
  component: BroadcastPodium,
  title: 'widgets/BroadcastPodium',
} as Meta<typeof BroadcastPodium>;

type Story = StoryObj;

// The podium only shows after the checkered flag, or in demo mode.
const DemoMode = (Story: ComponentType) => (
  <DashboardProvider
    bridge={{
      ...mockDashboardBridge,
      onDemoModeChanged: (callback) => {
        callback(true);
        return () => undefined;
      },
    }}
  >
    <Story />
  </DashboardProvider>
);

const frame = (children: React.ReactNode) => (
  <div
    className="w-[300px] text-sm"
    style={{ ['--bg-opacity' as string]: '90%' }}
  >
    {children}
  </div>
);

export const Primary: Story = {
  render: () => (
    <div className="w-[300px]">
      <BroadcastPodium />
    </div>
  ),
  decorators: [
    DemoMode,
    TelemetryDecorator('/test-data/1747384033336'),
    CaptureChannelDecorator('/test-data/1747384033336'),
  ],
};

export const Steps: Story = {
  render: () => frame(<PodiumCard groups={groups} look="steps" />),
};

export const Trophies: Story = {
  render: () => frame(<PodiumCard groups={groups} look="trophy" />),
};
