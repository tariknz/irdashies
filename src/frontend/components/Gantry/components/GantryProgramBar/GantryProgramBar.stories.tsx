import type { Meta, StoryObj } from '@storybook/react-vite';
import { GantryProgramBar } from './GantryProgramBar';

const meta: Meta<typeof GantryProgramBar> = {
  component: GantryProgramBar,
  title: 'widgets/Gantry/components/GantryProgramBar',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    onBackToProgram: { action: 'back-to-program' },
    onStayHere: { action: 'make-current-live' },
    onResumeAtCut: { action: 'resume-at-cut' },
  },
  decorators: [
    (Story) => (
      <div className="w-full bg-slate-900 text-white">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof GantryProgramBar>;

export const BehindProgram: Story = {
  args: {
    sessionTime: 3600,
    cutawaySessionTime: 3661,
    liveSessionTime: 3680,
    isCutAway: true,
  },
};

export const LiveEdge: Story = {
  args: {
    sessionTime: 100,
    cutawaySessionTime: 100,
    liveSessionTime: 120,
    isCutAway: true,
  },
};

export const OnProgram: Story = {
  args: {
    sessionTime: 1800,
    cutawaySessionTime: null,
    liveSessionTime: 1800,
    isCutAway: false,
  },
};
