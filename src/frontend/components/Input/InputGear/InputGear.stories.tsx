import React from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { InputGear } from './InputGear';

const withContainer = (Story: React.ComponentType) => (
  <div className="w-32 h-32 bg-slate-800 rounded-md p-2">
    <Story />
  </div>
);

export default {
  component: InputGear,
  title: 'widgets/Input/components/InputGear',
  decorators: [withContainer],
  argTypes: {
    gear: {
      control: {
        type: 'range',
        min: -1,
        max: 8,
        step: 1,
      },
    },
    speedMs: {
      control: {
        type: 'range',
        min: 0,
        max: 350,
        step: 1,
      },
    },
  },
} as Meta;

type Story = StoryObj<typeof InputGear>;

export const Primary: Story = {
  args: {
    gear: 1,
    speedMs: 30,
    unit: 1,
    settings: {
      size: 100,
      unit: 'auto',
      showspeed: true,
      showspeedunit: true,
    },
  },
};

export const Imperial: Story = {
  args: {
    gear: 1,
    speedMs: 30,
    unit: 0,
    settings: {
      size: 100,
      unit: 'auto',
      showspeed: true,
      showspeedunit: true,
    },
  },
};

export const ForceImperial: Story = {
  args: {
    gear: 1,
    speedMs: 30,
    unit: 1,
    settings: {
      size: 100,
      unit: 'mph',
      showspeed: true,
      showspeedunit: true,
    },
  },
};
export const SwappedSpeedUnit: Story = {
  args: {
    gear: 3,
    speedMs: 35,
    unit: 1,
    settings: {
      size: 100,
      unit: 'auto',
      showspeed: true,
      showspeedunit: true,
      swapSpeedUnit: true,
    },
  },
};
