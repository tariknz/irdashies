import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SlowCarAheadConfig } from '@irdashies/types';
import { SlowCarAheadDisplay } from './SlowCarAhead';

const meta: Meta<typeof SlowCarAheadDisplay> = {
  title: 'widgets/SlowCarAhead',
  component: SlowCarAheadDisplay,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '250px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SlowCarAheadDisplay>;

const mockConfig = (
  overrides: Partial<SlowCarAheadConfig> = {}
): SlowCarAheadConfig => {
  const baseConfig: SlowCarAheadConfig = {
    slowSpeedThreshold: 50,
    stoppedSpeedThreshold: 10,
    maxDistance: 250,
    barThickness: 10,
  };

  return {
    ...baseConfig,
    ...overrides,
  };
};

const baseArgs = {
  speed: 10,
  distance: 400,
};

export const Default: Story = {
  name: 'Default View',
  args: {
    ...baseArgs,
    settings: mockConfig(),
  },
};
