import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TapeReplayControls } from './TapeReplayControls';

const meta = {
  title: 'Replay/TapeReplayControls',
  component: TapeReplayControls,
  decorators: [
    (Story) => (
      <div className="w-[620px]">
        <Story />
      </div>
    ),
  ],
  args: {
    status: {
      position: 142,
      duration: 600,
      speed: 1,
      paused: false,
      ended: false,
    },
    onCommand: fn(),
  },
} satisfies Meta<typeof TapeReplayControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playing: Story = {};
export const Paused: Story = {
  args: { status: { ...meta.args.status, paused: true, speed: 0.5 } },
};
export const FastForward: Story = {
  args: { status: { ...meta.args.status, speed: 10 } },
};
export const EndOfTape: Story = {
  args: { status: { ...meta.args.status, position: 600, ended: true } },
};
export const Error: Story = {
  args: { error: 'Could not update replay playback' },
};
