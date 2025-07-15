import { Meta, StoryObj } from '@storybook/react-vite';
import {  FasterCarsFromBehind, FasterCarsFromBehindDisplay } from './FasterCarsFromBehind';
import { TelemetryDecorator } from '@irdashies/storybook';

export default {
  component: FasterCarsFromBehindDisplay,
  argTypes: {
    classColor: {
      options: [undefined, 0xffda59, 0x33ceff, 0xff5888, 0xae6bff, 0xffffff],
      control: { type: 'select' },
      description: 'Background color for the component'
    }
  }
} as Meta<typeof FasterCarsFromBehindDisplay>;

type Story = StoryObj<typeof FasterCarsFromBehindDisplay>;

export const Primary: Story = {
  render: () => <FasterCarsFromBehind />,
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};

export const Display: Story = {
  args: {
    name: 'Tom Wilson',
    distance: -1.0,
    percent: 50,
    classColor: 0xffda59,
  },
};
