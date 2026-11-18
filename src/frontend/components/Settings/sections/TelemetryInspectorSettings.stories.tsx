import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import { TelemetryInspectorSettings } from './TelemetryInspectorSettings';

const meta: Meta<typeof TelemetryInspectorSettings> = {
  component: TelemetryInspectorSettings,
  id: 'settings-legacy-telemetry-inspector',
  title: 'components/Settings/TelemetryInspector',
  // This legacy editor has no current SettingsLoader route. Keep its visual
  // regression fixture separate rather than restoring a production menu item.
  decorators: [
    (Story) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <div className="settings-shell h-[700px] bg-slate-900 p-4 text-slate-200">
          <Story />
        </div>
      </DashboardProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
