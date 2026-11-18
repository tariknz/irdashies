import type { Meta, StoryObj } from '@storybook/react-vite';
import { GitHubStarNotice } from './GitHubStarPrompt';

const meta = {
  title: 'components/Settings/GitHubStarPrompt',
  component: GitHubStarNotice,
  args: { onDismiss: () => undefined },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="settings-shell h-screen bg-slate-950">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GitHubStarNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
