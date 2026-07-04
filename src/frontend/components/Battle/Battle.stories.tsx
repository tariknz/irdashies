import { Meta, StoryObj } from '@storybook/react-vite';
import { Battle } from './Battle';
import { TelemetryDecorator } from '@irdashies/storybook';

export default {
  component: Battle,
  title: 'widgets/Battle',
} as Meta<typeof Battle>;

type Story = StoryObj<typeof Battle>;

export const Primary: Story = {
  render: () => <Battle />,
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};
