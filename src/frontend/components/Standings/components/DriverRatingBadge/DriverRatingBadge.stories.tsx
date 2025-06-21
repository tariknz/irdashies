import { Meta, StoryObj } from '@storybook/react-vite';
import { DriverRatingBadge } from './DriverRatingBadge';

export default {
  component: DriverRatingBadge,
} as Meta;

type Story = StoryObj<typeof DriverRatingBadge>;

export const Primary: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
  },
};

export const Alien: Story = {
  args: {
    license: 'A 4.99',
    rating: 12200,
  },
};

export const AllRatings: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <DriverRatingBadge license="A 4.99" rating={4999} />
      <DriverRatingBadge license="B 3.99" rating={3999} />
      <DriverRatingBadge license="C 2.99" rating={2999} />
      <DriverRatingBadge license="D 1.99" rating={1999} />
      <DriverRatingBadge license="R 0.99" rating={999} />
      <DriverRatingBadge license="R 02.99" rating={999} />
    </div>
  ),
};
