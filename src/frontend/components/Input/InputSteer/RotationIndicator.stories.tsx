import type { Meta, StoryObj } from '@storybook/react-vite';
import { RotationIndicator } from './RotationIndicator';

const meta: Meta<typeof RotationIndicator> = {
  component: RotationIndicator,
  title: 'widgets/Input/components/RotationIndicator',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    currentAngleRad: {
      control: {
        type: 'range',
        min: -2*3.14,
        max: 2*3.14,
        step: 0.01,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CenterPosition: Story = {
  args: {
    currentAngleRad: 0, // 0 degrees - center
  },
};

export const SmallRight: Story = {
  args: {
    currentAngleRad: 0.25, // ~14 degrees - small right
  },
};

export const SmallLeft: Story = {
  args: {
    currentAngleRad: -0.25, // ~-14 degrees - small left
  },
};

export const MediumRight: Story = {
  args: {
    currentAngleRad: 0.5, // ~29 degrees - medium right
  },
};

export const MediumLeft: Story = {
  args: {
    currentAngleRad: -0.5, // ~-29 degrees - medium left
  },
};

export const FullRight: Story = {
  args: {
    currentAngleRad: 2 * Math.PI, // 360 degrees - full right
  },
};

export const FullLeft: Story = {
  args: {
    currentAngleRad: -2 * Math.PI, // -360 degrees - full left
  },
};

export const BeyondRange: Story = {
  args: {
    currentAngleRad: 3 * Math.PI, // 540 degrees - beyond range
  },
};

export const BeyondRangeNegative: Story = {
  args: {
    currentAngleRad: -3 * Math.PI, // -540 degrees - beyond range
  },
}; 