import type { Meta, StoryObj } from '@storybook/react-vite';
import { GantrySessionEndedBanner } from './GantrySessionEndedNotice';

const meta: Meta<typeof GantrySessionEndedBanner> = {
  component: GantrySessionEndedBanner,
  title: 'widgets/Gantry/components/GantrySessionEndedNotice',
  parameters: { layout: 'fullscreen' },
  argTypes: {
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

type Story = StoryObj<typeof GantrySessionEndedBanner>;

/** Shown after the sim closes, while the Gantry holds the finished session. */
export const Default: Story = {};
