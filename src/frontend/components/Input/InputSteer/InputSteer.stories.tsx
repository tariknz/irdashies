import { Meta, StoryObj } from '@storybook/react-vite';
import { InputSteer } from './InputSteer';

export default {
  component: InputSteer,
  argTypes: {
    angleRad: {
      control: {
        type: 'range',
        min: -3.14,
        max: 3.14,
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

export const AllWheels: Story = {
  render: () => {
    const wheelStyles = ['default', 'formula', 'lmp', 'nascar', 'ushape'] as const;
    const colors = ['light', 'dark'] as const;
    
    return (
      <div className="p-8 space-y-8">
        {colors.map((color) => (
          <div key={color} className="space-y-4">
            <h3 className="text-xl font-semibold capitalize">
              {color} Mode
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {wheelStyles.map((style) => (
                <div key={style} className="text-center space-y-2">
                  <div className="capitalize text-sm font-medium">{style}</div>
                  <div className="flex justify-center">
                    <InputSteer
                      angleRad={0}
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
