import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { WidgetScaleSettings } from './WidgetScaleSettings';
import { SettingsSection } from './SettingSection';

const meta = {
  component: WidgetScaleSettings,
  title: 'components/WidgetScaleSettings',
  decorators: [
    TelemetryDecorator(),
    (Story) => (
      <div className="settings-shell bg-slate-900 p-4">
        <Story />
      </div>
    ),
  ],
  args: { widgetId: 'standings' },
  render: ({ widgetId }) => (
    <SettingsSection title="Display" scaleWidgetId={widgetId} />
  ),
} satisfies Meta<typeof WidgetScaleSettings>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
