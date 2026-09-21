import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TyrePanelConfig } from '@irdashies/types';
import { TyrePanelView } from './TyrePanel';

const config: TyrePanelConfig = {
  background: { opacity: 80 },
  showOnlyWhenOnTrack: false,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
  pressureUnit: 'kPa',
  temperatureUnit: 'C',
  temperatureThresholds: { cold: 70, hot: 100 },
  wearThresholds: { worn: 60, replace: 30 },
};

const meta: Meta<typeof TyrePanelView> = {
  component: TyrePanelView,
  title: 'widgets/TyrePanel',
  decorators: [
    (Story) => (
      <div className="h-[180px] w-[300px]">
        <Story />
      </div>
    ),
  ],
  args: {
    config,
    isLive: true,
    temperature: [64, 84, 103, 91],
    pressure: [178.2, 180.1, 176.8, 179.4],
    wear: [0.82, 0.58, 0.3, 0.22],
  },
};

export default meta;
type Story = StoryObj<typeof TyrePanelView>;

export const Conditions: Story = {};

export const IracingPitSnapshot: Story = {
  args: { isLive: false },
};

export const MissingData: Story = {
  args: {
    temperature: [Number.NaN, 84],
    pressure: undefined,
    wear: [0.82, Number.NaN],
  },
};
