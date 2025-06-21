import type { Meta, StoryObj } from '@storybook/react-vite';
import { RatingChange } from './RatingChange';

const meta: Meta<typeof RatingChange> = {
  component: RatingChange,
};

export default meta;
type Story = StoryObj<typeof RatingChange>;

export const Positive: Story = {
  args: {
    value: 42,
  },
};

export const Negative: Story = {
  args: {
    value: -15,
  },
};

export const Zero: Story = {
  args: {
    value: 0,
  },
};

export const Undefined: Story = {
  args: {
    value: undefined,
  },
};

export const NotANumber: Story = {
  args: {
    value: Number.NaN,
  },
}; 