import { Meta, StoryObj } from '@storybook/react-vite';
import { InputSteer } from './InputSteer';

export default {
  component: InputSteer,
  title: 'widgets/Input/components/InputSteer',
  argTypes: {
    angleRad: {
      control: {
        type: 'range',
        min: -2 * 3.14,
        max: 2 * 3.14,
        step: 0.01,
      },
    },
  },
} as Meta;

type Story = StoryObj<typeof InputSteer>;

export const Primary: Story = {
  args: {
    angleRad: 0,
  },
};

export const Ring: Story = {
  args: {
    angleRad: 0.6,
    wheelStyle: 'ring',
    gear: 3,
    speedMs: 35, // ~126 km/h
    unit: 1, // metric
    gearSettings: {
      size: 100,
      unit: 'auto',
      showspeed: true,
      showspeedunit: true,
    },
  },
  render: (args) => (
    <div className="w-40 h-40 bg-slate-800 p-2 rounded-md">
      <InputSteer {...args} />
    </div>
  ),
};

export const AllWheels: Story = {
  args: {
    angleRad: 0,
  },
  render: ({ angleRad }) => {
    const wheelStyles = [
      'default',
      'formula',
      'lmp',
      'nascar',
      'ushape',
    ] as const;
    const colors = ['light', 'dark'] as const;

    return (
      <div className="p-8 space-y-8">
        {colors.map((color) => (
          <div key={color} className="space-y-4">
            <h3 className="text-xl font-semibold capitalize">{color} Mode</h3>
            <div className="grid grid-cols-5 gap-4">
              {wheelStyles.map((style) => (
                <div key={style} className="text-center space-y-2">
                  <div className="capitalize text-sm font-medium">{style}</div>
                  <div className="flex justify-center">
                    <InputSteer
                      angleRad={angleRad}
                      wheelStyle={style}
                      wheelColor={color}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
