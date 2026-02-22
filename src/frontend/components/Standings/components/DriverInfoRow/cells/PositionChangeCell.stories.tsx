import type { Meta, StoryObj } from '@storybook/react-vite';
import { PositionChangeCell } from './PositionChangeCell';

const meta: Meta<typeof PositionChangeCell> = {
  component: PositionChangeCell,
  title: 'widgets/Standings/components/PositionChangeCell',
  decorators: [
    (Story) => (
      <table>
        <tbody>
          <tr>
            <Story />
          </tr>
        </tbody>
      </table>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PositionChangeCell>;

export const GainedPositions: Story = {
  args: {
    positionChange: 3,
  },
};

export const LostPositions: Story = {
  args: {
    positionChange: -2,
  },
};

export const NoChange: Story = {
  args: {
    positionChange: 0,
  },
};

export const Unknown: Story = {
  args: {
    positionChange: undefined,
  },
};
