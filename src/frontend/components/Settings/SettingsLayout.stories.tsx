import { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import type { IrSdkBridge } from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';
import { mockDashboardBridge } from '@irdashies/storybook';

interface StoryProps {
  initialPath: string;
}

// The header reads the running state to decide whether to name a simulator.
// Nothing here drives a sim, so this only has to satisfy the provider.
const runningBridge: IrSdkBridge = {
  onSessionData: () => () => undefined,
  onRunningState: (callback) => {
    callback(true);
    return () => undefined;
  },
  stop: () => undefined,
};

const meta: Meta<typeof SettingsLayout> = {
  component: SettingsLayout,
  title: 'components/SettingsLayout',
  decorators: [
    (Story, context) => {
      const { initialPath = 'standings' } = context.args as StoryProps;
      return (
        <DashboardProvider bridge={mockDashboardBridge}>
          <RunningStateProvider bridge={runningBridge}>
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route
                  path="/settings/*"
                  element={
                    <div style={{ height: '100vh' }}>
                      <Story />
                    </div>
                  }
                />
              </Routes>
            </MemoryRouter>
          </RunningStateProvider>
        </DashboardProvider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof SettingsLayout>;

export const Default: Story = {
  args: {
    initialPath: '/settings/standings',
  },
};

// Add more stories for different routes
export const RelativeRoute: Story = {
  args: {
    initialPath: '/settings/relative',
  },
};

export const WeatherRoute: Story = {
  args: {
    initialPath: '/settings/weather',
  },
};

export const FlatTrackMapRoute: Story = {
  args: {
    initialPath: '/settings/flatmap',
  },
};
