import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  TelemetryDecorator,
  TelemetryDecoratorWithConfig,
} from '@irdashies/storybook';
import { BroadcastExcludedCarsSettings } from './BroadcastExcludedCarsSettings';

const meta = {
  title: 'components/Settings/BroadcastExcludedCarsSettings',
  component: BroadcastExcludedCarsSettings,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="settings-shell max-w-3xl p-6 text-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BroadcastExcludedCarsSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NothingExcluded: Story = {
  decorators: [TelemetryDecorator()],
};

export const WithExcludedCars: Story = {
  decorators: [
    TelemetryDecoratorWithConfig(undefined, {
      broadcast: {
        excludedCars: [
          { carId: 122, name: 'BMW M4 GT4' },
          { carId: 4242, name: 'Porsche 911 GT3 Cup Safety' },
        ],
      },
    }),
  ],
};
