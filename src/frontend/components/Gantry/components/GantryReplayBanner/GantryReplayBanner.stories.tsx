import type { Meta, StoryObj } from '@storybook/react-vite';
import { GantryReplayBanner } from './GantryReplayBanner';

const meta: Meta<typeof GantryReplayBanner> = {
  component: GantryReplayBanner,
  title: 'widgets/Gantry/components/GantryReplayBanner',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    provenance: {
      control: 'radio',
      options: ['archived', 'localNotArchived', 'foreign'],
      description: 'Where the loaded replay came from.',
    },
    onDismiss: { action: 'dismissed' },
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

type Story = StoryObj<typeof GantryReplayBanner>;

/** Case A: irDashies recorded this event on this PC. */
export const Archived: Story = {
  args: { provenance: 'archived' },
};

/** Case B: this PC's user recorded the replay, but nothing was archived. */
export const LocalNotArchived: Story = {
  args: { provenance: 'localNotArchived' },
};

/** Case C: the replay came from another computer. */
export const Foreign: Story = {
  args: { provenance: 'foreign' },
};
