import type { Decorator } from '@storybook/react-vite';
import { useEffect, useMemo } from 'react';
import {
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
  StoryTelemetryProvider,
} from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  LAP_GRAPH_LAP_WINDOW_BOUNDS,
  type ChannelBridge,
  type ChannelName,
  type ChannelPayloads,
  type GantryConfig,
  type IrSdkBridge,
  type LapGraphYAxisMode,
  type NameFormat,
  type Session,
  type SessionRetention,
} from '@irdashies/types';
import { generateMockDataFromPath } from '../src/app/bridge/iracingSdk/mock-data/generateMockData';
import { createMockBridgeWithConfig } from './telemetryDecorator';
import { standingsStorySnapshot } from './standingsSnapshot';
import { trackStateStorySnapshot } from './trackStateSnapshot';
import { RACE_SESSION_NUM, sprintLapHistory } from './lapHistorySnapshot';

const gantryDefaults = getWidgetDefaultConfig('gantry');

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/** Every channel the Gantry declares in its widget runtime definition. */
export type GantryChannels = Pick<
  ChannelPayloads,
  | 'standings.snapshot'
  | 'track-state.snapshot'
  | 'lap-times.snapshot'
  | 'lap-history.snapshot'
  | 'radio.snapshot'
>;

export const gantryChannelSnapshots = (
  overrides: Partial<GantryChannels> = {}
): GantryChannels => ({
  'standings.snapshot': {
    ...standingsStorySnapshot,
    sessionNum: RACE_SESSION_NUM,
  },
  'track-state.snapshot': {
    ...trackStateStorySnapshot,
    sessionNum: RACE_SESSION_NUM,
  },
  'lap-times.snapshot': {
    lapTimes: [],
    lapTimeHistory: [],
    sessionNum: RACE_SESSION_NUM,
    version: 0,
  },
  'lap-history.snapshot': sprintLapHistory,
  'radio.snapshot': { transmittingCarIdxs: [], version: 0 },
  ...overrides,
});

type ChannelOverrides =
  | Partial<GantryChannels>
  | ((args: Record<string, unknown>) => Partial<GantryChannels>);

/**
 * Bridges belonging to mounted decorators, oldest first.
 *
 * A docs page renders several stories at once, so each instance cannot simply
 * restore whatever it found on mount: the earliest one to unmount would put
 * back a bridge that a still-mounted story had replaced.
 */
const mountedBridges: ChannelBridge[] = [];

/** Whatever held the global before the first story mounted. */
let outerBridge: ChannelBridge | undefined;

const acquireBridge = (bridge: ChannelBridge) => {
  if (mountedBridges.length === 0) outerBridge = window.channelBridge;
  mountedBridges.push(bridge);
  window.channelBridge = bridge;
};

const releaseBridge = (bridge: ChannelBridge) => {
  const index = mountedBridges.lastIndexOf(bridge);
  if (index !== -1) mountedBridges.splice(index, 1);

  const top = mountedBridges[mountedBridges.length - 1];
  if (top) {
    window.channelBridge = top;
    return;
  }
  if (outerBridge === undefined) {
    Reflect.deleteProperty(window, 'channelBridge');
  } else {
    window.channelBridge = outerBridge;
  }
  outerBridge = undefined;
};

/**
 * Supplies `window.channelBridge` for a Gantry story.
 *
 * Put this LAST in a `decorators` array. Storybook nests the last entry
 * outermost, and the bridge has to exist before the widget's first render:
 * `getChannelSnapshotStore` keys a WeakMap on it, and an undefined key throws
 * "Invalid value used as weak map key".
 */
export const GantryChannelDecorator = (
  overrides: ChannelOverrides = {}
): Decorator => {
  const Component = (
    Story: Parameters<Decorator>[0],
    context: Parameters<Decorator>[1]
  ) => {
    // Args are primitives, so this is cheap and stable. The snapshots
    // themselves are far too large to stringify every render.
    const argsKey = JSON.stringify(context.args ?? {});

    const bridge = useMemo<ChannelBridge>(() => {
      const snapshots = gantryChannelSnapshots(
        typeof overrides === 'function'
          ? overrides(context.args as Record<string, unknown>)
          : overrides
      );
      // A control, so every Gantry story can toggle the replay jump buttons
      // without needing its own track-state override.
      const replay = (context.args as Partial<GantryStoryArgs>).isReplayPlaying;
      if (typeof replay === 'boolean') {
        snapshots['track-state.snapshot'] = {
          ...snapshots['track-state.snapshot'],
          isReplayPlaying: replay,
        };
      }
      return {
        subscribe: <K extends ChannelName>(
          channel: K,
          callback: (payload: ChannelPayloads[K]) => void
        ) => {
          const snapshot = (snapshots as Partial<ChannelPayloads>)[channel];
          if (snapshot !== undefined) callback(snapshot as ChannelPayloads[K]);
          return () => undefined;
        },
      };
      // Deliberately keyed on the args content, not the context identity.
    }, [argsKey]);

    // Assigned during render, not in an effect: the widget reads the bridge on
    // its first render, which happens before any effect runs.
    window.channelBridge = bridge;
    useEffect(() => {
      acquireBridge(bridge);
      return () => releaseBridge(bridge);
    }, [bridge]);

    return <Story />;
  };
  Component.displayName = 'GantryChannelDecorator';
  return Component;
};

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/** The Gantry config fields that visibly change the widget. */
export interface GantryStoryArgs {
  driverNameFormat: NameFormat;
  speedUnit: GantryConfig['speedUnit'];
  sessionRetention: SessionRetention;
  yAxisMode: LapGraphYAxisMode;
  lapWindow: number;
  autoPin: boolean;
  /** Not config: drives `track-state.snapshot`, which gates the replay buttons. */
  isReplayPlaying: boolean;
}

export const gantryStoryArgs: GantryStoryArgs = {
  driverNameFormat: gantryDefaults.driverNameFormat,
  speedUnit: gantryDefaults.speedUnit,
  sessionRetention: gantryDefaults.sessionRetention,
  yAxisMode: gantryDefaults.lapGraph.yAxisMode,
  lapWindow: gantryDefaults.lapGraph.lapWindow,
  autoPin: gantryDefaults.lapGraph.autoPin,
  isReplayPlaying: false,
};

const NAME_FORMATS: NameFormat[] = [
  'name-middlename-surname',
  'name-m.-surname',
  'name-surname',
  'n.-surname',
  'surname-n.',
  'surname',
];

export const gantryArgTypes = {
  driverNameFormat: {
    control: 'select',
    options: NAME_FORMATS,
    description: 'How driver names are written in the standings list.',
    table: { category: 'Gantry config' },
  },
  speedUnit: {
    control: 'inline-radio',
    options: ['auto', 'km/h', 'mph'],
    description: 'Units the incident speed thresholds are shown in.',
    table: { category: 'Gantry config' },
  },
  sessionRetention: {
    control: 'select',
    options: ['all', 5, 10, 20],
    description: 'How many past sessions of incidents are kept.',
    table: { category: 'Gantry config' },
  },
  yAxisMode: {
    control: 'inline-radio',
    options: ['trace', 'position', 'gap'],
    description: 'Which quantity the lap graph opens on.',
    table: { category: 'Lap graph config' },
  },
  lapWindow: {
    control: {
      type: 'range',
      min: LAP_GRAPH_LAP_WINDOW_BOUNDS.min,
      max: LAP_GRAPH_LAP_WINDOW_BOUNDS.max,
      step: 5,
    },
    description: 'Laps visible before the user zooms.',
    table: { category: 'Lap graph config' },
  },
  autoPin: {
    control: 'boolean',
    description:
      'Auto-pin the player, the class leader, and the cars around the player.',
    table: { category: 'Lap graph config' },
  },
  isReplayPlaying: {
    control: 'boolean',
    description:
      "Whether the sim is playing a replay. Off disables the incident feed's jump buttons.",
    table: { category: 'Session state' },
  },
} as const;

export const gantryConfigFromArgs = (
  args: Partial<GantryStoryArgs> = {}
): GantryConfig => ({
  ...gantryDefaults,
  driverNameFormat: args.driverNameFormat ?? gantryDefaults.driverNameFormat,
  speedUnit: args.speedUnit ?? gantryDefaults.speedUnit,
  sessionRetention: args.sessionRetention ?? gantryDefaults.sessionRetention,
  lapGraph: {
    yAxisMode: args.yAxisMode ?? gantryDefaults.lapGraph.yAxisMode,
    lapWindow: args.lapWindow ?? gantryDefaults.lapGraph.lapWindow,
    autoPin: args.autoPin ?? gantryDefaults.lapGraph.autoPin,
  },
});

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const staticSessionBridge = (session: Session): IrSdkBridge => ({
  onSessionData: (callback) => {
    callback(session);
    return () => undefined;
  },
  onRunningState: (callback) => {
    callback(true);
    return () => undefined;
  },
  stop: () => undefined,
});

export interface GantryDecoratorOptions {
  /** Recorded telemetry to play back. Omit for the bundled mock session. */
  telemetryPath?: string;
  /** A hand-built session, used instead of playing back mock telemetry. */
  session?: Session;
}

/**
 * Session, telemetry and dashboard providers for a Gantry story. The widget's
 * config is rebuilt from the story's args, so the Controls panel edits the real
 * dashboard config rather than a copy.
 */
export const GantryDecorator = (
  options: GantryDecoratorOptions = {}
): Decorator => {
  const { telemetryPath, session } = options;

  const Component = (
    Story: Parameters<Decorator>[0],
    context: Parameters<Decorator>[1]
  ) => {
    const config = gantryConfigFromArgs(
      context.args as Partial<GantryStoryArgs>
    );
    // Keyed on the config's content: a control change must rebuild the bridge
    // so the provider republishes, but an unrelated re-render must not.
    const configKey = JSON.stringify(config);
    const dashboardBridge = useMemo(
      () => createMockBridgeWithConfig({ gantry: JSON.parse(configKey) }),
      [configKey]
    );

    // Held across arg changes, or every control tweak restarts playback. Each
    // provider gets its own bridge, matching TelemetryDecorator, so one
    // unmounting cannot stop the feed the others are reading.
    const bridges = useMemo(
      () =>
        session
          ? {
              session: staticSessionBridge(session),
              telemetry: undefined,
              running: staticSessionBridge(session),
            }
          : {
              session: generateMockDataFromPath(telemetryPath),
              telemetry: generateMockDataFromPath(telemetryPath),
              running: generateMockDataFromPath(telemetryPath),
            },
      // Both come from the factory's options, which never change.
      []
    );

    return (
      <>
        <SessionProvider bridge={bridges.session} />
        {bridges.telemetry && (
          <StoryTelemetryProvider bridge={bridges.telemetry} />
        )}
        <DashboardProvider bridge={dashboardBridge}>
          <RunningStateProvider bridge={bridges.running}>
            <Story />
          </RunningStateProvider>
        </DashboardProvider>
      </>
    );
  };
  Component.displayName = 'GantryDecorator';
  return Component;
};
