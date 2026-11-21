import type { Meta, StoryObj } from '@storybook/react-vite';
import { DamageDisplay } from './components/DamageDisplay';
import { DEMO_DAMAGE, UNDAMAGED } from './logic';

export default {
  component: DamageDisplay,
  title: 'widgets/Damage',
} as Meta;

type Story = StoryObj<typeof DamageDisplay>;

const box = (width = 170, height = 240): Story['decorators'] => [
  (Story) => (
    <div style={{ width, height }}>
      <Story />
    </div>
  ),
];

export const GtFrontUndamaged: Story = {
  args: {
    data: UNDAMAGED,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'gtFront',
    carLabel: 'BMW M4 GT3',
  },
  decorators: box(),
};

export const GtMidUndamaged: Story = {
  args: {
    data: UNDAMAGED,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'gtMid',
    carLabel: 'Ferrari 296 GT3',
  },
  decorators: box(),
};

export const GtRearUndamaged: Story = {
  args: {
    data: UNDAMAGED,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'gtRear',
    carLabel: 'Porsche 992 GT3 R',
  },
  decorators: box(),
};

export const GtFrontDamaged: Story = {
  args: {
    data: DEMO_DAMAGE,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'gtFront',
  },
  decorators: box(),
};

export const GtMidDamaged: Story = {
  args: {
    data: DEMO_DAMAGE,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'gtMid',
  },
  decorators: box(),
};

export const GtRearDamaged: Story = {
  args: {
    data: DEMO_DAMAGE,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'gtRear',
  },
  decorators: box(),
};

export const PrototypeUndamaged: Story = {
  args: {
    data: UNDAMAGED,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'prototype',
  },
  decorators: box(),
};

export const OpenWheel: Story = {
  args: {
    data: DEMO_DAMAGE,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'openwheel',
  },
  decorators: box(),
};

export const Hatch: Story = {
  args: {
    data: UNDAMAGED,
    opacity: 80,
    showIntegrity: true,
    showStats: false,
    bodyStyle: 'hatch',
  },
  decorators: box(),
};
