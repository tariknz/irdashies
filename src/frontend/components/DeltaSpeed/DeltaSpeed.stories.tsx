import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef } from 'react';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';
import {
  useDriverCarIdx,
  useReferenceLapStore,
  useTelemetryStore,
} from '@irdashies/context';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  TrackStateSnapshot,
} from '@irdashies/types';
import { DeltaSpeed } from './DeltaSpeed';
import { buildMockSpeedLap } from './mockSpeedLap';
import { mockTrackState } from './mockTrackState';

export default {
  component: DeltaSpeed,
  title: 'widgets/DeltaSpeed',
  decorators: [TelemetryDecorator()],
  args: {
    background: { opacity: 80 },
    unit: 'km/h',
    scaleKph: 15,
    scaleMph: 10,
    capKph: 30,
    capMph: 20,
    updateThresholdKph: 0.3,
    updateThresholdMph: 0.2,
    showNumber: true,
    // Mock telemetry is not necessarily flagged on-track, so don't gate on it.
    showOnlyWhenOnTrack: false,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
} as Meta<typeof DeltaSpeed>;

type Story = StoryObj<typeof DeltaSpeed>;

/**
 * A track-state channel bridge that can be pushed to.
 *
 * ChannelSnapshotDecorator serves one frozen snapshot, which is enough for most
 * widgets but would leave this one's whole point — a bar that moves — sitting
 * still. This republishes the mock telemetry stream onto the channel instead,
 * so the story exercises the real subscription path at real update rates.
 */
const createLiveTrackState = () => {
  const listeners = new Set<(snapshot: TrackStateSnapshot) => void>();
  let latest = mockTrackState();

  const bridge: ChannelBridge = {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void
    ) => {
      if (channel !== 'track-state.snapshot') return () => undefined;
      const listener = (snapshot: TrackStateSnapshot) =>
        callback(snapshot as ChannelPayloads[K]);
      listeners.add(listener);
      listener(latest);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  const publish = (overrides: Partial<TrackStateSnapshot>) => {
    latest = { ...latest, ...overrides, version: latest.version + 1 };
    for (const listener of listeners) listener(latest);
  };

  return { bridge, publish };
};

const liveTrackState = createLiveTrackState();

/**
 * Seeds a synthetic session-best lap for whichever car the mock session says is
 * the player, and pumps the mock telemetry stream onto the track-state channel,
 * so the widget resolves everything through its real data path.
 */
function LiveDataSeeder() {
  const playerCarIdx = useDriverCarIdx();
  const previousBridge = useRef(window.channelBridge);
  window.channelBridge = liveTrackState.bridge;

  useEffect(() => {
    if (playerCarIdx == null) return;
    // Lap geometry (pointsCount, interval) rides on the lap itself; the
    // renderer store only mirrors the maps published by the main process.
    const previousBestLaps = useReferenceLapStore.getState().bestLaps;
    useReferenceLapStore.setState({
      bestLaps: new Map([[playerCarIdx, buildMockSpeedLap()]]),
    });
    // The store is a module singleton shared by every story. Without this,
    // navigating from a live story to NoReferenceLap would leave the seeded lap
    // in place and render a delta instead of the empty state it exists to show.
    return () => {
      useReferenceLapStore.setState({ bestLaps: previousBestLaps });
    };
  }, [playerCarIdx]);

  useEffect(
    () =>
      useTelemetryStore.subscribe((state) => {
        const speed = state.telemetry?.Speed?.value?.[0];
        const lapDistPct = state.telemetry?.LapDistPct?.value?.[0];
        if (speed === undefined || lapDistPct === undefined) return;
        liveTrackState.publish({ speed, lapDistPct, isOnTrack: true });
      }),
    []
  );

  useEffect(() => {
    const restore = previousBridge.current;
    return () => {
      if (restore === undefined)
        Reflect.deleteProperty(window, 'channelBridge');
      else window.channelBridge = restore;
    };
  }, []);

  return null;
}

/**
 * The widget against the mock telemetry stream, driven by the real
 * useDeltaSpeed hook. The delta moves as the mock lap position advances.
 */
export const Live: Story = {
  render: (args) => (
    <>
      <LiveDataSeeder />
      <DeltaSpeed {...args} />
    </>
  ),
};

export const LiveMph: Story = {
  ...Live,
  args: { unit: 'mph' },
};

export const LiveBarOnly: Story = {
  ...Live,
  args: { showNumber: false },
};

/**
 * No reference lap seeded — the widget holds its slot and says why it has
 * nothing to show, rather than disappearing and leaving a gap that reads as a
 * broken or misconfigured widget.
 */
/** Belt and braces: assert the empty state rather than inheriting it. */
function NoReferenceLapSeeder() {
  useEffect(() => {
    useReferenceLapStore.setState({ bestLaps: new Map() });
  }, []);
  return null;
}

export const NoReferenceLap: Story = {
  decorators: [
    ChannelSnapshotDecorator({ 'track-state.snapshot': mockTrackState() }),
  ],
  render: (args) => (
    <>
      <NoReferenceLapSeeder />
      <DeltaSpeed {...args} />
    </>
  ),
};
