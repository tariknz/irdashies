import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { WidgetScaleSettings } from './WidgetScaleSettings';

const meta = {
  component: WidgetScaleSettings,
  title: 'components/WidgetScaleSettings',
  decorators: [TelemetryDecorator()],
  args: { widgetId: 'standings' },
} satisfies Meta<typeof WidgetScaleSettings>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
