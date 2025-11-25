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
    format: 'license-color-rating-bw',
  },
};

export const Alien: Story = {
  args: {
    license: 'A 4.99',
    rating: 12200,
    format: 'license-color-rating-bw',
  },
};

export const AllRatings: Story = {
  args: {
    format: 'license-color-rating-bw',
  },
  render: (args) => (
    <div className="flex flex-col gap-1">
      <DriverRatingBadge {...args} license="P 4.99" rating={12999} />
      <DriverRatingBadge {...args} license="A 4.99" rating={4999} />
      <DriverRatingBadge {...args} license="B 3.99" rating={3999} />
      <DriverRatingBadge {...args} license="C 2.99" rating={2999} />
      <DriverRatingBadge {...args} license="D 1.99" rating={1999} />
      <DriverRatingBadge {...args} license="R 0.99" rating={999} />
      <DriverRatingBadge {...args} license="R 02.99" rating={999} />
    </div>
  ),
};

export const FormatLicenseColorRatingBw: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'license-color-rating-bw',
  },
};

export const FormatLicenseColorRatingBwNoLicense: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'license-color-rating-bw-no-license',
  },
};

export const FormatRatingColorNoLicense: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'rating-color-no-license',
  },
};

export const FormatLicenseBwRatingBw: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'license-bw-rating-bw',
  },
};

export const FormatRatingOnlyBwRatingBw: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'rating-only-bw-rating-bw',
  },
};

export const FormatLicenseBwRatingBwNoLicense: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'license-bw-rating-bw-no-license',
  },
};

export const FormatRatingBwNoLicense: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'rating-bw-no-license',
  },
};

export const FormatRatingOnlyColorRatingBw: Story = {
  args: {
    license: 'A 4.99',
    rating: 4999,
    format: 'rating-only-color-rating-bw',
  },
};
