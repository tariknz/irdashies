import { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import type {
  DashboardBridge,
  DriverTagSettings,
  PitLaneBridge,
  IrSdkBridge,
  ActiveSimulator,
} from '@irdashies/types';
import {
  DEFAULT_KEYBINDINGS,
  DEFAULT_SIM_WIDGET_SUPPORT,
} from '@irdashies/types';
import { NavigationPrototype } from './NavigationPrototype';
import { SettingsLayout } from '../SettingsLayout';
import { mockDashboardBridge } from '@irdashies/storybook';

interface StoryProps {
  initialPath: string;
  emptyFuel?: boolean;
  simulator?: ActiveSimulator;
  headerProfilePicker?: boolean;
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

// Reproduce the observed Extra Small preference without touching a real profile.
const settingsPreviewBridge: DashboardBridge = {
  ...mockDashboardBridge,
  getDriverTagSettings: async () => structuredClone(driverTagsFixture),
  saveDriverTagSettings: async () => undefined,
  dashboardUpdated: (callback) =>
    mockDashboardBridge.dashboardUpdated((dashboard, profileId) =>
      callback(
        {
          ...dashboard,
          generalSettings: {
            ...dashboard.generalSettings,
            fontType: 'lato',
            fontSize: 'xs',
            fontWeight: 'normal',
          },
        },
        profileId
      )
    ),
};

const driverTagsFixture: DriverTagSettings = {
  groups: [
    { id: 'team', name: 'Endurance team', color: 0xf87171, icon: 'UsersThree' },
    {
      id: 'league',
      name: 'League drivers',
      color: 0x7dd3fc,
      icon: 'FlagCheckered',
    },
  ],
  entries: [
    { id: '10001', name: 'Alex Morgan', label: 'TEAM', groupId: 'team' },
    { id: '10002', name: 'Jamie Taylor', label: 'LEAGUE', groupId: 'league' },
  ],
  mapping: {},
  display: { enabled: true, displayStyle: 'badge', iconWeight: 'regular' },
};

const installSettingsBridges = () => {
  const previousPitLane = window.pitLaneBridge;
  const previousKeybindings = window.keybindingsBridge;
  let hasCalibration = true;
  let learningPaused = false;
  window.pitLaneBridge = {
    getPitLaneData: async (trackId) => ({
      trackId,
      sourceId: 'settings-fixture',
      revision: 0,
      data: null,
    }),
    updatePitLaneData: async () => true,
    getCurrentTrackPitLaneInfo: async () => ({
      trackId: '47',
      trackName: 'WeatherTech Raceway Laguna Seca',
      hasCalibration,
      learningPaused,
    }),
    resetPitLaneData: async () => {
      hasCalibration = false;
    },
    openPitLaneDataFile: async () => {
      learningPaused = true;
    },
    reloadPitLaneDataFile: async () => {
      throw new Error('Isolated fixture: calibration file is invalid');
    },
  } satisfies PitLaneBridge;
  let bindings = structuredClone(DEFAULT_KEYBINDINGS);
  window.keybindingsBridge = {
    getKeybindings: async () => bindings,
    getRegistrationErrors: async () => ({}),
    updateKeybinding: async (id, accelerator) => {
      bindings = {
        ...bindings,
        [id]: { ...bindings[id], accelerator, isDefault: false },
      };
      return bindings;
    },
    resetKeybinding: async () =>
      (bindings = structuredClone(DEFAULT_KEYBINDINGS)),
    resetAllKeybindings: async () =>
      (bindings = structuredClone(DEFAULT_KEYBINDINGS)),
    startRecording: async () => undefined,
    stopRecording: async () => undefined,
    onGamepadCaptured: () => () => undefined,
  };
  return () => {
    window.pitLaneBridge = previousPitLane;
    window.keybindingsBridge = previousKeybindings;
  };
};

const meta: Meta<typeof NavigationPrototype> = {
  component: NavigationPrototype,
  title: 'research/Settings Navigation',
  parameters: { layout: 'fullscreen' },
  beforeEach: installSettingsBridges,
  decorators: [
    (Story, context) => {
      const {
        initialPath = '/settings/relative',
        emptyFuel,
        simulator = 'iracing',
        headerProfilePicker,
      } = context.args as StoryProps;
      // Two in-memory profiles share the navigation dashboard; no app data is read.
      const fixtureProfiles = ['Default', 'Endurance'].map((name, index) => ({
        id: index === 0 ? 'default' : 'endurance',
        name,
        createdAt: '2026-11-06T00:00:00.000Z',
        lastModified: '2026-11-06T00:00:00.000Z',
      }));
      let activeFixtureProfile = 'default';
      const fixtureBridge: DashboardBridge = {
        ...settingsPreviewBridge,
        ...(headerProfilePicker && {
          listProfiles: async () => structuredClone(fixtureProfiles),
          getCurrentProfile: async () =>
            structuredClone(
              fixtureProfiles.find(
                (profile) => profile.id === activeFixtureProfile
              ) ?? fixtureProfiles[0]
            ),
          switchProfile: async (id: string) => {
            if (fixtureProfiles.some((profile) => profile.id === id))
              activeFixtureProfile = id;
          },
        }),
        getActiveSimulator: async () => simulator,
        onSimulatorChanged: (callback) => {
          callback(simulator);
          return () => undefined;
        },
        getSimWidgetSupport: async () =>
          structuredClone(DEFAULT_SIM_WIDGET_SUPPORT),
      };
      return (
        <DashboardProvider
          bridge={
            emptyFuel
              ? {
                  ...fixtureBridge,
                  dashboardUpdated: (callback) =>
                    settingsPreviewBridge.dashboardUpdated(
                      (dashboard, profileId) =>
                        callback(
                          {
                            ...dashboard,
                            widgets: dashboard.widgets.filter(
                              (widget) => (widget.type ?? widget.id) !== 'fuel'
                            ),
                          },
                          profileId
                        )
                    ),
                }
              : fixtureBridge
          }
        >
          <RunningStateProvider bridge={runningBridge}>
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route
                  path="/settings/*"
                  element={
                    <div
                      className="overlay-window overlay-theme-xs overlay-theme-font-face-lato overlay-theme-font-weight-normal fixed inset-0 overflow-hidden"
                      style={{ height: '100vh' }}
                    >
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

type Story = StoryObj<typeof NavigationPrototype>;

// Research alternatives stay isolated; Baseline renders current production.
// Historical baseline captures are preserved outside the worktree.
export const Baseline: Story = {
  args: { variant: 'top', initialPath: '/settings/relative' },
  render: () => <SettingsLayout />,
};
export const GroupedLinks: Story = {
  args: { variant: 'grouped', initialPath: '/settings/relative' },
};
export const AreaSplit: Story = {
  args: { variant: 'split', initialPath: '/settings/relative' },
};
export const TopAppLinks: Story = {
  args: { variant: 'top', initialPath: '/settings/relative' },
};
export const GroupedGeneral: Story = {
  args: { variant: 'grouped', initialPath: '/settings/general' },
};
export const SplitGeneral: Story = {
  args: { variant: 'split', initialPath: '/settings/general' },
};
export const TopGeneral: Story = {
  args: { variant: 'top', initialPath: '/settings/general' },
};
export const GroupedLmu: Story = {
  args: {
    variant: 'grouped',
    initialPath: '/settings/relative',
    simulator: 'lmu',
  },
};
export const SplitLmu: Story = {
  args: {
    variant: 'split',
    initialPath: '/settings/relative',
    simulator: 'lmu',
  },
};
export const TopLmu: Story = {
  args: { variant: 'top', initialPath: '/settings/relative', simulator: 'lmu' },
};

// Follow-up: local navigation follows the active area in both candidates.
export const ContextualOverlays: Story = {
  args: { variant: 'contextual', initialPath: '/settings/relative' },
};
export const ContextualGeneral: Story = {
  args: { variant: 'contextual', initialPath: '/settings/general' },
};
export const ContextualProfiles: Story = {
  args: { variant: 'contextual', initialPath: '/settings/profiles' },
};
export const ContextualLmu: Story = {
  args: {
    variant: 'contextual',
    initialPath: '/settings/relative',
    simulator: 'lmu',
  },
};
export const DedicatedOverlays: Story = {
  args: { variant: 'dedicated', initialPath: '/settings/relative' },
};
export const DedicatedGeneral: Story = {
  args: { variant: 'dedicated', initialPath: '/settings/general' },
};
export const DedicatedProfiles: Story = {
  args: { variant: 'dedicated', initialPath: '/settings/profiles' },
};
export const DedicatedLmu: Story = {
  args: {
    variant: 'dedicated',
    initialPath: '/settings/relative',
    simulator: 'lmu',
  },
};

export const DedicatedProfileShortcut: Story = {
  args: {
    variant: 'dedicated',
    headerProfilePicker: true,
    initialPath: '/settings/relative',
  },
};
export const DedicatedProfileShortcutPage: Story = {
  args: {
    variant: 'dedicated',
    headerProfilePicker: true,
    initialPath: '/settings/profiles',
  },
};
export const DedicatedProfileShortcutLmu: Story = {
  args: {
    variant: 'dedicated',
    headerProfilePicker: true,
    initialPath: '/settings/relative',
    simulator: 'lmu',
  },
};

export const DedicatedHeaderProfile: Story = {
  args: {
    variant: 'dedicated',
    headerProfilePicker: true,
    initialPath: '/settings/relative',
  },
};
export const DedicatedHeaderProfilePage: Story = {
  args: {
    variant: 'dedicated',
    headerProfilePicker: true,
    initialPath: '/settings/profiles',
  },
};
export const DedicatedHeaderProfileLmu: Story = {
  args: {
    variant: 'dedicated',
    headerProfilePicker: true,
    initialPath: '/settings/relative',
    simulator: 'lmu',
  },
};
