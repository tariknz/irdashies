import { useEffect, useState } from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import type {
  ActiveSimulator,
  DashboardBridge,
  DriverTagSettings,
  PitLaneBridge,
  IrSdkBridge,
  ReleaseNotesBridge,
  ReleaseNotesStatus,
} from '@irdashies/types';
import { DEFAULT_KEYBINDINGS, releaseNotesFixture } from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';
import { GitHubStarNotice } from './GitHubStarPrompt/GitHubStarPrompt';
import {
  ChannelSnapshotDecorator,
  mockDashboardBridge,
} from '@irdashies/storybook';

interface StoryProps {
  initialPath: string;
  emptyFuel?: boolean;
  scaleInstances?: boolean;
  initialTab?:
    | {
        key: 'fuelWidgetTab' | 'inputTab' | 'standingsTab' | 'lapTimeTab';
        value: 'display' | 'options';
      }
    // The overlay list's order, kept in local storage like a tab.
    | { key: 'settingsMenuSort'; value: 'alpha' | 'activated' };

  profileChoices?: boolean;
  profileName?: string;
  simulator?: ActiveSimulator;
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

const offlineBridge: IrSdkBridge = {
  ...runningBridge,
  onRunningState: (callback) => {
    callback(false);
    return () => undefined;
  },
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

/** Install isolated bridges and tab state, restoring their prior values on cleanup. */
const installSettingsBridges = (initialTab?: StoryProps['initialTab']) => {
  const previousTab = initialTab ? localStorage.getItem(initialTab.key) : null;
  if (initialTab) localStorage.setItem(initialTab.key, initialTab.value);
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
    resetKeybinding: async (actionId) => {
      bindings = {
        ...bindings,
        [actionId]: structuredClone(DEFAULT_KEYBINDINGS[actionId]),
      };
      return bindings;
    },
    resetAllKeybindings: async () =>
      (bindings = structuredClone(DEFAULT_KEYBINDINGS)),
    startRecording: async () => undefined,
    stopRecording: async () => undefined,
    onGamepadCaptured: () => () => undefined,
  };
  return () => {
    window.pitLaneBridge = previousPitLane;
    window.keybindingsBridge = previousKeybindings;
    if (initialTab) {
      if (previousTab === null) localStorage.removeItem(initialTab.key);
      else localStorage.setItem(initialTab.key, previousTab);
    }
  };
};

const meta: Meta<typeof SettingsLayout> = {
  component: SettingsLayout,
  title: 'components/SettingsLayout',
  parameters: { layout: 'fullscreen' },
  beforeEach: ({ args }) =>
    installSettingsBridges((args as StoryProps).initialTab),
  decorators: [
    ChannelSnapshotDecorator({}),
    (Story, context) => {
      const {
        initialPath = 'standings',
        emptyFuel,
        scaleInstances,
        profileChoices,
        profileName,
        simulator,
      } = context.args as StoryProps;
      const choices = [profileName ?? 'Default', 'Endurance'].map(
        (name, index) => ({
          id: index === 0 ? 'default' : 'endurance',
          name,
          createdAt: '2026-11-06T00:00:00.000Z',
          lastModified: '2026-11-06T00:00:00.000Z',
        })
      );
      let activeProfile = 'default';
      const previewBridge: DashboardBridge = {
        ...settingsPreviewBridge,
        ...(simulator && { getActiveSimulator: async () => simulator }),
        ...(profileChoices && {
          listProfiles: async () => structuredClone(choices),
          getCurrentProfile: async () =>
            structuredClone(
              choices.find((profile) => profile.id === activeProfile) ??
                choices[0]
            ),
          switchProfile: async (id: string) => {
            if (choices.some((profile) => profile.id === id))
              activeProfile = id;
          },
        }),
      };
      return (
        <DashboardProvider
          bridge={
            emptyFuel || scaleInstances
              ? {
                  ...previewBridge,
                  dashboardUpdated: (callback) =>
                    settingsPreviewBridge.dashboardUpdated(
                      (dashboard, profileId) =>
                        callback(
                          {
                            ...dashboard,
                            widgets: emptyFuel
                              ? dashboard.widgets.filter(
                                  (widget) =>
                                    (widget.type ?? widget.id) !== 'fuel'
                                )
                              : [
                                  ...dashboard.widgets,
                                  ...dashboard.widgets
                                    .filter((widget) =>
                                      ['fuel', 'input', 'standings'].includes(
                                        widget.id
                                      )
                                    )
                                    .flatMap((widget) => [
                                      {
                                        ...structuredClone(widget),
                                        id: `${widget.id}-review`,
                                        type: widget.id,
                                        scale: 125,
                                        ...(widget.id === 'standings'
                                          ? { placement: 'gantry' as const }
                                          : {}),
                                      },
                                      ...(widget.id === 'fuel'
                                        ? [
                                            {
                                              ...structuredClone(widget),
                                              id: 'fuel-docked',
                                              type: 'fuel',
                                              placement: 'gantry' as const,
                                              scale: 90,
                                            },
                                          ]
                                        : []),
                                    ]),
                                ],
                          },
                          profileId
                        )
                    ),
                }
              : previewBridge
          }
        >
          <RunningStateProvider
            bridge={
              context.parameters.githubStarPreview
                ? offlineBridge
                : runningBridge
            }
          >
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route
                  path="/settings/*"
                  element={
                    <div className="overlay-window overlay-theme-xs overlay-theme-font-face-lato overlay-theme-font-weight-normal h-screen">
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
    initialPath: '/settings',
  },
};

export const OverlaysAlphabetical: Story = {
  args: {
    initialPath: '/settings/standings',
    initialTab: { key: 'settingsMenuSort', value: 'alpha' },
  },
};

export const OverlaysActivatedFirst: Story = {
  args: {
    initialPath: '/settings/standings',
    initialTab: { key: 'settingsMenuSort', value: 'activated' },
  },
};

export const GeneralSettings: Story = {
  args: { initialPath: '/settings/general' },
};

/** The About page, with what usage analytics collects. */
export const AboutRoute: Story = {
  args: { initialPath: '/settings/about' },
};

// Show the notice immediately for visual review without changing real preferences.
export const GitHubStarPrompt: Story = {
  args: { initialPath: '/settings/general' },
  parameters: { githubStarPreview: true },
  render: () => {
    const [visible, setVisible] = useState(true);
    return (
      <>
        <SettingsLayout />
        {visible && (
          <div className="settings-shell">
            <GitHubStarNotice onDismiss={() => setVisible(false)} />
          </div>
        )}
      </>
    );
  },
};

export const FuelRoute: Story = {
  args: { initialPath: '/settings/fuel' },
};

export const FuelEmpty: Story = {
  args: { initialPath: '/settings/fuel', emptyFuel: true },
};

export const FuelCustomScale: Story = {
  args: {
    initialPath: '/settings/fuel-review',
    scaleInstances: true,
    initialTab: { key: 'fuelWidgetTab', value: 'display' },
  },
};

export const FuelDockedScale: Story = {
  args: {
    initialPath: '/settings/fuel-docked',
    scaleInstances: true,
    initialTab: { key: 'fuelWidgetTab', value: 'display' },
  },
};

export const InputCustomScale: Story = {
  args: {
    initialPath: '/settings/input-review',
    scaleInstances: true,
    initialTab: { key: 'inputTab', value: 'options' },
  },
};

export const LapTraceLayout: Story = {
  args: {
    initialPath: '/settings/laptrace',
    initialTab: { key: 'lapTraceTab', value: 'layout' },
  },
};

export const StandingsDockedScale: Story = {
  args: {
    initialPath: '/settings/standings-review',
    scaleInstances: true,
    initialTab: { key: 'standingsTab', value: 'display' },
  },
};

export const StandingsStyling: Story = {
  args: {
    initialPath: '/settings/standings',
    initialTab: { key: 'standingsTab', value: 'styling' },
  },
};

export const ProfilesRoute: Story = {
  args: { initialPath: '/settings/profiles' },
};

export const LapTimerHistory: Story = {
  args: {
    initialPath: '/settings/laptimelog',
    initialTab: { key: 'lapTimeTab', value: 'display' },
  },
};

export const DriverTagsRoute: Story = {
  args: { initialPath: '/settings/driver-tags' },
};

export const SetupComparisonRoute: Story = {
  args: { initialPath: '/settings/car-setup' },
};

export const CalibrationRoute: Story = {
  args: { initialPath: '/settings/pitlanehelper' },
};
export const AdvancedRoute: Story = {
  args: { initialPath: '/settings/advanced' },
};

export const KeybindingsRoute: Story = {
  args: { initialPath: '/settings/keybindings' },
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
    getReleases: async (page) => ({
      status: 'ready',
      releases: (page === 1
        ? ['2.1.0', '2.0.0', '1.9.0', '1.8.2', '1.8.1', '1.8.0', '1.7.0']
        : ['1.6.0', '1.5.0']
      ).map((version, index) => ({
        version,
        title: `irDashies ${version}`,
        publishedAt: new Date(Date.UTC(2026, 9 - index, 18)).toISOString(),
      })),
      hasMore: page === 1,
      cached: false,
    }),
    getRelease: async (version) => ({
      status: 'ready',
      release: releaseNotesFixture(version),
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

// Controlled disk-full bridge response; no disk space is consumed.
export const StorageFull: Story = {
  args: { initialPath: '/settings/fuel' },
  decorators: [
    (Story) => {
      const previous = window.storageStatusBridge;
      window.storageStatusBridge = {
        onStatus: (callback) => {
          callback({ diskFull: true });
          return () => undefined;
        },
      };
      useEffect(
        () => () => {
          window.storageStatusBridge = previous;
        },
        [previous]
      );
      return <Story />;
    },
  ],
};

export const ProfilePicker: Story = {
  args: { initialPath: '/settings/relative', profileChoices: true },
};

export const CompactHeader: Story = {
  args: {
    initialPath: '/settings/relative',
    profileChoices: true,
    simulator: 'iracing',
  },
};

export const LongProfileName: Story = {
  args: {
    ...CompactHeader.args,
    profileName: 'Weekend endurance championship setup',
  },
};
