import { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import type {
  DashboardBridge,
  IrSdkBridge,
  KeybindingsBridge,
} from '@irdashies/types';
import {
  ChannelSnapshotDecorator,
  mockDashboardBridge,
} from '@irdashies/storybook';
import { SettingsLayout } from '../SettingsLayout';
import { SettingsTranslator } from './SettingsTranslator';

interface StoryProps {
  initialPath: string;
  /** Adds a second, inactive profile so the Switch button shows. */
  twoProfiles?: boolean;
}

const twoProfilesBridge: DashboardBridge = {
  ...mockDashboardBridge,
  listProfiles: async () => [
    ...(await mockDashboardBridge.listProfiles()),
    {
      id: 'race-night',
      name: 'Race night',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
  ],
};

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
      const { initialPath = '/settings/general', twoProfiles = false } =
        context.args as StoryProps;
      return (
        <DashboardProvider
          bridge={twoProfiles ? twoProfilesBridge : mockDashboardBridge}
        >
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
  beforeEach: () => {
    const original = window.keybindingsBridge;
    window.keybindingsBridge = {
      getKeybindings: async () => structuredClone(DEFAULT_KEYBINDINGS),
      getRegistrationErrors: async () => ({}),
      updateKeybinding: async () => structuredClone(DEFAULT_KEYBINDINGS),
      resetKeybinding: async () => structuredClone(DEFAULT_KEYBINDINGS),
      resetAllKeybindings: async () => structuredClone(DEFAULT_KEYBINDINGS),
      startRecording: async () => undefined,
      stopRecording: async () => undefined,
      onGamepadCaptured: () => () => undefined,
    } satisfies KeybindingsBridge;
    return () => {
      window.keybindingsBridge = original;
    };
  },
};
export const Profiles: Story = { args: { initialPath: '/settings/profiles' } };
export const ProfilesTwoProfiles: Story = {
  args: { initialPath: '/settings/profiles', twoProfiles: true },
};
export const Radar: Story = { args: { initialPath: '/settings/radar' } };
export const PitlaneHelper: Story = {
  args: { initialPath: '/settings/pitlanehelper' },
};
export const Broadcast: Story = {
  args: { initialPath: '/settings/broadcast' },
  decorators: [ChannelSnapshotDecorator({})],
};
export const LapTrace: Story = { args: { initialPath: '/settings/laptrace' } };
