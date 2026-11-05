import { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import type { IrSdkBridge } from '@irdashies/types';
import { mockDashboardBridge } from '@irdashies/storybook';
import { SettingsLayout } from '../SettingsLayout';
import { SettingsTranslator } from './SettingsTranslator';

interface StoryProps {
  initialPath: string;
}

const runningBridge: IrSdkBridge = {
  onSessionData: () => () => undefined,
  onRunningState: (callback) => {
    callback(true);
    return () => undefined;
  },
  stop: () => undefined,
};

const meta: Meta<StoryProps> = {
  title: 'components/Settings/SettingsTranslator',
  render: () => (
    <>
      <SettingsTranslator language="ru" />
      <SettingsLayout />
    </>
  ),
  decorators: [
    (Story, context) => {
      const { initialPath = '/settings/general' } = context.args as StoryProps;
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

type Story = StoryObj<StoryProps>;

export const General: Story = { args: { initialPath: '/settings/general' } };
export const Standings: Story = {
  args: { initialPath: '/settings/standings' },
};
export const Fuel: Story = { args: { initialPath: '/settings/fuel' } };
export const KeyBindings: Story = {
  args: { initialPath: '/settings/keybindings' },
};
export const Profiles: Story = { args: { initialPath: '/settings/profiles' } };
