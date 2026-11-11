import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { WidgetPreview } from './WidgetPreview';

export default {
  title: 'components/Settings/WidgetPreview',
  component: WidgetPreview,
  decorators: [
    TelemetryDecorator(),
    (Story) => (
      <div className="max-w-4xl bg-slate-900 p-5">
        <Story />
      </div>
    ),
  ],
  args: { widgetId: 'input' },
} satisfies Meta<typeof WidgetPreview>;

export const DesktopRequired: StoryObj<typeof WidgetPreview> = {};
