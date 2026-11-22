import { useEffect, useState } from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  DashboardProvider,
  RunningStateProvider,
  useSessionStore,
} from '@irdashies/context';
import type {
  ActiveSimulator,
  AppUpdateStatus,
  DashboardBridge,
  DriverTagSettings,
  PitLaneBridge,
  IrSdkBridge,
  ReleaseNotesBridge,
  ReleaseNotesStatus,
  Session,
} from '@irdashies/types';
import { DEFAULT_KEYBINDINGS, releaseNotesFixture } from '@irdashies/types';
import { SettingsLayout } from './SettingsLayout';
import { GitHubStarNotice } from './GitHubStarPrompt/GitHubStarPrompt';
import {
  ChannelSnapshotDecorator,
  mockDashboardBridge,
} from '@irdashies/storybook';
import setupSessionFixture from '../../../../test-data/1770713899767/session.json';

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

// The header selects the simulator and profile itself. This bridge only
// satisfies providers the settings tree still reads.
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

export const SetupComparisonSnapshots: Story = {
  args: SetupComparisonRoute.args,
  beforeEach: () => {
    const { session } = useSessionStore.getState();
    return () => useSessionStore.setState({ session });
  },
  play: async ({ canvas, userEvent }) => {
    const { CarSetup: setup } = setupSessionFixture;
    const setSetup = (index: number, pressure: number, temperatures: string) =>
      useSessionStore.getState().setSession({
        ...setupSessionFixture,
        CarSetup: {
          ...setup,
          UpdateCount: setup.UpdateCount + index,
          TiresAero: {
            ...setup.TiresAero,
            LeftFront: {
              ...setup.TiresAero.LeftFront,
              ColdPressure: `${pressure} kPa`,
              LastTempsOMI: temperatures,
            },
          },
        },
      } as unknown as Session);

    const variants = [
      [124, '41C, 41C, 41C'],
      [131, '92C, 88C, 84C'],
      [131, '106C, 101C, 98C'],
    ] as const;
    for (const [index, [pressure, temperatures]] of variants.entries()) {
      setSetup(index, pressure, temperatures);
      const capture = await canvas.findByRole('button', {
        name: 'Take Snapshot',
      });
      await waitFor(() => expect(capture).toBeEnabled());
      await userEvent.click(capture);
      await expect(capture).toBeDisabled();
    }
    setSetup(variants.length, 138, '92C, 89C, 85C');
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Take Snapshot' })
      ).toBeEnabled()
    );
  },
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

export const FasterCarsFromBehindRoute: Story = {
  args: {
    initialPath: '/settings/fastercarsfrombehind',
  },
};

export const WeatherRoute: Story = {
  args: {
    initialPath: '/settings/weather',
  },
};

/** The Broadcast menu, with the Tower's Look tab. */
export const BroadcastTowerRoute: Story = {
  args: {
    initialPath: '/settings/broadcast',
    initialTab: { key: 'broadcastTab', value: 'look' },
  },
};

export const BroadcastTowerOptions: Story = {
  args: {
    initialPath: '/settings/broadcast',
    initialTab: { key: 'broadcastTab', value: 'options' },
  },
};

export const BroadcastEventsRoute: Story = {
  args: {
    initialPath: '/settings/broadcastevents',
    initialTab: { key: 'broadcasteventsTab', value: 'events' },
  },
};

export const BroadcastSettingsRoute: Story = {
  args: {
    initialPath: '/settings/broadcast-settings',
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

const withUpdatesStatus =
  (initial: Partial<AppUpdateStatus> = {}, downloadDelay = 0) =>
  () => {
    const previous = window.appUpdatesBridge;
    let notify: (status: AppUpdateStatus) => void;
    let timer: number | undefined;
    let status: AppUpdateStatus = {
      currentVersion: '3.0.0',
      latestVersion: '3.1.0',
      autoUpdate: true,
      preferenceSaveFailed: false,
      canUpdate: true,
      newerVersionAvailable: true,
      checkingLatest: false,
      latestCheckFailed: false,
      restartNotice: false,
      phase: 'idle',
      ...initial,
    };
    const update = (partial: Partial<AppUpdateStatus>) => {
      status = { ...status, ...partial };
      notify(status);
    };
    window.appUpdatesBridge = {
      onStatus: (callback) => {
        notify = callback;
        notify(status);
        return () => undefined;
      },
      checkLatest: async () => notify(status),
      setAutoUpdate: async (autoUpdate) => update({ autoUpdate }),
      install: async (action) => {
        if (action === 'restart') {
          if (status.phase === 'ready') update({ phase: 'restarting' });
          return;
        }
        if (status.phase !== 'idle') return;
        update({ phase: 'downloading' });
        const finish = () =>
          update({
            phase: 'ready',
            latestVersion: '3.1.0',
            newerVersionAvailable: true,
          });
        if (downloadDelay) timer = window.setTimeout(finish, downloadDelay);
        else finish();
      },
    };
    return () => {
      window.clearTimeout(timer);
      window.appUpdatesBridge = previous;
    };
  };

export const UpdatesPage: Story = {
  args: { initialPath: '/settings/updates' },
  beforeEach: withUpdatesStatus(),
};

export const UpdatesCurrentRelease: Story = {
  args: { initialPath: '/settings/updates' },
  beforeEach: withUpdatesStatus({
    latestVersion: '3.0.0',
    autoUpdate: false,
    newerVersionAvailable: false,
  }),
};

export const SidebarUpdate: Story = {
  args: { initialPath: '/settings/relative' },
  beforeEach: withUpdatesStatus({ autoUpdate: false }, 2_000),
};

export const UpdateReadyNotice: Story = {
  args: { initialPath: '/settings/general' },
  beforeEach: withUpdatesStatus({ phase: 'ready', restartNotice: true }),
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
