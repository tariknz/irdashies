import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import type { ShiftPointSettings } from '@irdashies/types';
import { ShiftLights } from './ShiftLights';
import { ShiftLightsComponent } from './components/ShiftLightsComponent';

const meta: Meta<typeof ShiftLights> = {
  component: ShiftLights,
  title: 'widgets/Shift Lights/Widget',
  decorators: [TelemetryDecorator()],
};
export default meta;
type Story = StoryObj<typeof ShiftLights>;

const settings = (
  indicatorType: ShiftPointSettings['indicatorType']
): ShiftPointSettings => ({
  enabled: true,
  indicatorType,
  indicatorColor: '#00ff66',
  carConfigs: {
    storycar: {
      enabled: true,
      carId: 'storycar',
      carName: 'Story Car',
      gearCount: 6,
      redlineRpm: 8000,
      gearShiftPoints: { '3': { shiftRpm: 7000 } },
    },
  },
});

export const Primary: Story = {
  render: () => (
    <div className="h-[60px] w-[180px]">
      <ShiftLightsComponent
        rpm={7200}
        gear={3}
        carId="storycar"
        shiftPointSettings={settings('glow')}
      />
    </div>
  ),
};

export const IndicatorStyles: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      {(['glow', 'border', 'pulse'] as const).map((style) => (
        <div key={style} className="h-[60px] w-[180px]">
          <p className="mb-2 text-center text-sm capitalize text-slate-300">
            {style}
          </p>
          <ShiftLightsComponent
            rpm={7200}
            gear={3}
            carId="storycar"
            shiftPointSettings={settings(style)}
          />
        </div>
      ))}
    </div>
  ),
};
