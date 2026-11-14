import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import {
  defaultDashboard,
  type DashboardBridge,
  type DashboardLayout,
} from '@irdashies/types';
import { GantryPitStopSettings } from './GantryPitStopSettings';
import { newPitProfile, withGantryPitStops } from './gantryPitStopEdits';

const withProfiles = withGantryPitStops(defaultDashboard, {
  profiles: [newPitProfile('testcar', 'Test Car')],
});

const bridgeWith = (dashboard: DashboardLayout): DashboardBridge => ({
  ...mockDashboardBridge,
  dashboardUpdated: (callback) => {
    callback(dashboard, undefined);
    return () => undefined;
  },
});

const meta = {
  title: 'components/Settings/GantryPitStopSettings',
  component: GantryPitStopSettings,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GantryPitStopSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoCars: Story = {
  decorators: [
    (Story) => (
      <DashboardProvider bridge={bridgeWith(defaultDashboard)}>
        <div className="settings-shell max-w-3xl p-6 text-white">
          <Story />
        </div>
      </DashboardProvider>
    ),
  ],
};

export const WithACar: Story = {
  decorators: [
    (Story) => (
      <DashboardProvider bridge={bridgeWith(withProfiles)}>
        <div className="settings-shell max-w-3xl p-6 text-white">
          <Story />
        </div>
      </DashboardProvider>
    ),
  ],
};
