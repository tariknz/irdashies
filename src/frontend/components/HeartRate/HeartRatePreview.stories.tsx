import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeartRatePreview } from './HeartRatePreview';

export default {
  title: 'widgets/HeartRate/Offline preview',
  component: HeartRatePreview,
  decorators: [
    (Story) => (
      <div className="h-28 w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeartRatePreview>;

export const Default: StoryObj<typeof HeartRatePreview> = {};
