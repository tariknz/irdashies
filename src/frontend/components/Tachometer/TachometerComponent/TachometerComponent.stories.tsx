import type { Meta, StoryObj } from '@storybook/react-vite';
import { EngineWarnings } from '@irdashies/types';
import { Tachometer } from './TachometerComponent';

const meta: Meta<typeof Tachometer> = {
  component: Tachometer,
  title: 'widgets/Tachometer/Presentation',
  args: {
    rpm: 6240,
    maxRpm: 8000,
    showRpmText: true,
    oilTemp: 108,
    waterTemp: 92,
    showOilTemp: true,
    showWaterTemp: true,
    opacity: 80,
    shiftRpm: 7000,
    blinkRpm: 7600,
    gearRpmThresholds: [
      7000, 4200, 4700, 5200, 5700, 6100, 6400, 6600, 6800, 6900, 7000,
    ],
    ledColors: [
      '#FF000000',
      '#FF22C55E',
      '#FF22C55E',
      '#FF22C55E',
      '#FF22C55E',
      '#FF22C55E',
      '#FFEAB308',
      '#FFEAB308',
      '#FFEF4444',
      '#FFEF4444',
      '#FFEF4444',
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Tachometer>;

export const Default: Story = {
  render: (args) => (
    <div className="h-[100px] w-[500px]">
      <Tachometer {...args} />
    </div>
  ),
};

export const TemperaturesWithoutRpm: Story = {
  args: { showRpmText: false },
  render: (args) => (
    <div className="h-[100px] w-[500px]">
      <Tachometer {...args} />
    </div>
  ),
};

export const TemperatureWarnings: Story = {
  args: {
    engineWarnings:
      EngineWarnings.OilTempWarning | EngineWarnings.WaterTempWarning,
  },
  render: (args) => (
    <div className="h-[100px] w-[500px]">
      <Tachometer {...args} />
    </div>
  ),
};
