import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  GantryChannelDecorator,
  GantryDecorator,
  gantryArgTypes,
  gantryStoryArgs,
} from '@irdashies/storybook';
import type { NameFormat } from '@irdashies/types';
import { GantryStandings } from './GantryStandings';

interface StandingsArgs {
  followedCarIdx: number | null;
  driverNameFormat: NameFormat;
}

const meta: Meta<StandingsArgs> = {
  component: GantryStandings,
  title: 'widgets/Gantry/components/GantryStandings',
  parameters: { layout: 'fullscreen' },
  args: {
    followedCarIdx: null,
    driverNameFormat: gantryStoryArgs.driverNameFormat,
  },
  argTypes: {
    followedCarIdx: {
      control: 'number',
      description:
        'Car scrolled into view and highlighted. Clear it to follow nobody.',
      table: { category: 'Props' },
    },
    driverNameFormat: gantryArgTypes.driverNameFormat,
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-slate-900">
        <Story />
      </div>
    ),
    GantryDecorator(),
    // Last, so it wraps everything: window.channelBridge must exist before the
    // widget's first render.
    GantryChannelDecorator(),
  ],
};
export default meta;
type Story = StoryObj<StandingsArgs>;

export const Default: Story = {};

export const WithFollowedDriver: Story = {
  args: { followedCarIdx: 2 },
};

/** The alignment case: too narrow for the columns, so the table scrolls. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[420px] h-[480px]">
        <Story />
      </div>
    ),
  ],
};
