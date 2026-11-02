import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { IndividualWidgetView } from './IndividualWidgetWindow';

const meta = {
  component: IndividualWidgetView,
  title: 'windows/IndividualWidget',
  decorators: [TelemetryDecorator()],
  args: {
    running: true,
    widget: {
      id: 'input',
      type: 'input',
      enabled: true,
      layout: { x: 20, y: 20, width: 440, height: 120 },
      config: { ...getWidgetDefaultConfig('input') },
    },
  },
} satisfies Meta<typeof IndividualWidgetView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Input: Story = {};
export const Disconnected: Story = { args: { running: false } };
