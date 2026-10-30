import type { Meta, StoryObj } from '@storybook/react-vite';
import { DamageDisplay } from './components/DamageDisplay';
import { DEMO_DAMAGE } from './logic';

export default {
  component: DamageDisplay,
  title: 'widgets/Damage',
} as Meta;

type Story = StoryObj<typeof DamageDisplay>;

const box =
  (width = 160, height = 260): Story['decorators'] =>
  [
    (Story) => (
      <div style={{ width, height }}>
        <Story />
      </div>
    ),
  ];

export const GtDamaged: Story = {
  args: {
    data: DEMO_DAMAGE,
    opacity: 80,
    showIntegrity: true,
    showStats: true,
    bodyStyle: 'gt',
    carLabel: 'Ferrari 296 GT3',
  },
  decorators: box(),
};

export const Prototype: Story = {
  args: {
    data: DEMO_DAMAGE,
    opacity: 80,
    showIntegrity: true,
    showStats: true,
    bodyStyle: 'prototype',
    carLabel: 'Porsche 963',
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
    carLabel: 'Ray FF1600',
  },
  decorators: box(140, 200),
};

export const Hatch: Story = {
  args: {
    data: {
      ...DEMO_DAMAGE,
      dentSeverity: [0, 1, 0, 0, 0, 0, 0, 0],
    },
    opacity: 80,
    showIntegrity: true,
    showStats: true,
    bodyStyle: 'hatch',
    carLabel: 'Mazda MX-5 Cup',
  },
  decorators: box(),
};

export const IracingRepairNeeded: Story = {
  args: {
    data: {
      dentSeverity: [],
      wheelDetached: [false, false, false, false],
      suspensionDamage: [],
      tyreWear: [0.85, 0.9, 0.4, 0.88],
      aeroDamage: undefined,
      repairTime: 18.2,
      optRepairTime: 6.5,
      repairNeeded: true,
      optRepairNeeded: true,
    },
    opacity: 80,
    showIntegrity: true,
    showStats: true,
    bodyStyle: 'gt',
    carLabel: 'Porsche 992 GT3 R',
  },
  decorators: box(),
};
