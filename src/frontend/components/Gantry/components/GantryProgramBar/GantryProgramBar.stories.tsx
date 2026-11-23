import type { Meta, StoryObj } from '@storybook/react-vite';
import { GantryProgramBar } from './GantryProgramBar';

const meta: Meta<typeof GantryProgramBar> = {
  component: GantryProgramBar,
  title: 'widgets/Gantry/components/GantryProgramBar',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    onBackToProgram: { action: 'back-to-program' },
    onStayHere: { action: 'stay-here' },
    onResumeAtCut: { action: 'resume-at-cut' },
  },
  decorators: [
    (Story) => (
      <div className="w-[900px] bg-slate-900 text-white">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof GantryProgramBar>;

export const BehindProgram: Story = {
  args: {
    programSessionTime: 3661,
    offsetSeconds: 45,
    wasLive: false,
  },
};

export const LiveEdge: Story = {
  args: {
    programSessionTime: 100,
    offsetSeconds: 0,
    wasLive: true,
  },
};

export const OnProgram: Story = {
  args: {
    programSessionTime: 1800,
    offsetSeconds: 0,
    wasLive: false,
  },
};
