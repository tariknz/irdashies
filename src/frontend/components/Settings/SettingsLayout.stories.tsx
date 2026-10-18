import { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import type {
  IrSdkBridge,
  ReleaseNotesBridge,
  ReleaseNotesStatus,
} from '@irdashies/types';
import { releaseNotesFixture } from '../../../types/releaseNotesFixture';
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

const withReleaseNotesBadge = () => {
  const previous = window.releaseNotesBridge;
  let status: ReleaseNotesStatus = {
    currentVersion: '2.1.0',
    unreadVersion: '2.1.0',
    pendingVersion: null,
    availableVersion: null,
    autoShow: false,
    development: true,
    simulation: true,
  };
  const bridge: ReleaseNotesBridge = {
    getStatus: async () => ({ ...status }),
    getRelease: async () => ({
      status: 'ready',
      release: releaseNotesFixture(),
      cached: false,
    }),
    dismiss: async () => {
      status = { ...status, unreadVersion: null, pendingVersion: null };
    },
    setAutoShow: async (enabled) => {
      status = { ...status, autoShow: enabled };
    },
  };
  window.releaseNotesBridge = bridge;
  return () => {
    window.releaseNotesBridge = previous;
  };
};

export const NewReleaseNotesBadge: Story = {
  args: { initialPath: '/settings/general' },
  beforeEach: withReleaseNotesBadge,
};
export const ReleaseNotesPage: Story = {
  args: { initialPath: '/settings/release-notes' },
  beforeEach: withReleaseNotesBadge,
};
