import type { Meta, StoryObj } from '@storybook/react-vite';
import { CornerNameOverlay } from './CornerNameOverlay';
import {
  BorderRadiusDecorator,
  TelemetryDecorator,
  borderRadiusStoryArgTypes,
  borderRadiusStoryArgs,
} from '@irdashies/storybook';

// Real recorded sessions are used so the bundled-data lookup resolves naturally
// from WeekendInfo.TrackName — no manual store overrides. As the recording
// plays back, the widget cycles through sections in real time.

export default {
  component: CornerNameOverlay,
  title: 'widgets/CornerNameOverlay',
  args: {
    ...borderRadiusStoryArgs,
    showCornerNumber: true,
    showProgressBar: true,
    showTrackPct: true,
    fontSize: 18,
    opacity: 0.9,
  },
  argTypes: borderRadiusStoryArgTypes,
  decorators: [
    BorderRadiusDecorator,
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof CornerNameOverlay>;

export const SpaGrandPrix: Story = {
  decorators: [TelemetryDecorator('/test-data/1732274253573')],
};

export const Suzuka: Story = {
  decorators: [TelemetryDecorator('/test-data/1762847139582')],
};

export const Interlagos: Story = {
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};

export const LimeRockGP: Story = {
  decorators: [TelemetryDecorator('/test-data/1731639076383')],
};

export const LargeFontSize: Story = {
  args: { fontSize: 24 },
  decorators: [TelemetryDecorator('/test-data/1732274253573')],
};
