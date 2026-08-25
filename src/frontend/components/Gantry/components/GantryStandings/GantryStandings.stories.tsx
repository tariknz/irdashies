import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { GantryStandings } from './GantryStandings';

const meta: Meta<typeof GantryStandings> = {
  component: GantryStandings,
  decorators: [TelemetryDecorator()],
};
export default meta;

export const Default: StoryObj<typeof GantryStandings> = {
  args: { followedCarIdx: null },
};

export const WithFollowedDriver: StoryObj<typeof GantryStandings> = {
  args: { followedCarIdx: 2 },
};

/** The alignment case: too narrow for the columns, so the table scrolls. */
export const Narrow: StoryObj<typeof GantryStandings> = {
  args: { followedCarIdx: null },
  decorators: [
    (Story) => (
      <div className="w-[420px] h-[480px]">
        <Story />
      </div>
    ),
  ],
};
