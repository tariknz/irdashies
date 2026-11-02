import type { Meta, StoryObj } from '@storybook/react-vite';
import { LmuBadge } from './LmuBadge';

const meta: Meta<typeof LmuBadge> = {
  component: LmuBadge,
  title: 'Components/LmuBadge',
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof LmuBadge>;

export const Saint: Story = { args: { badge: 'sr-saint' } };

/** Every marker the service is known to issue. */
export const AllBadges: Story = {
  render: () => (
    <div className="flex items-center gap-4 bg-slate-900 p-3 text-xs">
      {(
        [
          'sr-noob',
          'sr-saint',
          'sr-clean',
          'sr-warning',
          'sr-probation',
        ] as const
      ).map((badge) => (
        <div key={badge} className="flex flex-col items-center gap-1">
          <LmuBadge badge={badge} />
          <span className="text-slate-400">{badge}</span>
        </div>
      ))}
    </div>
  ),
};

/** A marker added after the art was last fetched: nothing is drawn. */
export const Unknown: Story = { args: { badge: 'sr-unheard-of' } };
