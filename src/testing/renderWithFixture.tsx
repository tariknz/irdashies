import type { ReactNode } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  DashboardBridge,
  DashboardLayout,
} from '@irdashies/types';
import { defaultDashboard } from '@irdashies/types';
import { StandingsProcessor } from '../app/processors/StandingsProcessor';
import {
  RelativeGapProcessor,
  type ReferenceLapSource,
} from '../app/processors/RelativeGapProcessor';
import { DashboardProvider } from '../frontend/context/DashboardContext/DashboardContext';
import { useSessionStore } from '../frontend/context/SessionStore/SessionStore';
import { toSession, toTelemetry, type ReplayFixture } from './replayFixture';

/**
 * Mounts widget hooks against a real capture.
 *
 * The standings hooks sit behind three things at once — a dashboard config, a
 * session, and several channels — which is why they were among the least
 * covered code in the app despite being the heart of every standings widget.
 * This wires all three from a fixture so they can be exercised directly.
 */

/**
 * The dashboard bridge is wide and grows over time. Rather than stub every
 * method and rediscover a missing one each time the interface moves, answer
 * anything unimplemented with a no-op.
 *
 * The default returns an unsubscribe function, which serves both shapes on the
 * bridge: subscribers keep it to tear down, and callers that await a fire and
 * forget method get a harmless value they do not read.
 */
const dashboardBridgeStub = (dashboard: DashboardLayout): DashboardBridge => {
  const implemented: Record<string, unknown> = {
    dashboardUpdated: (callback: (value: DashboardLayout) => void) => {
      callback(dashboard);
      return () => undefined;
    },
    resetDashboard: async () => dashboard,
    getAppVersion: async () => '0.0.0-test',
    listProfiles: async () => [],
  };

  return new Proxy(implemented, {
    get: (target, property: string) =>
      property in target ? target[property] : () => () => undefined,
  }) as unknown as DashboardBridge;
};

export interface FixtureHarness {
  wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element;
  /** Advances the channels to a given frame of the fixture. */
  seekTo: (frameIndex: number) => void;
  focusCarIdx: number;
}

/**
 * Runs the fixture through the real processors and publishes their snapshots on
 * a stub channel bridge, so hooks see the same shapes they see in the app
 * rather than hand-built snapshots that can drift from the processors.
 */
export const mountFixture = (
  fixture: ReplayFixture,
  options: { dashboard?: DashboardLayout } = {}
): FixtureHarness => {
  const session = toSession(fixture);
  const standings = new StandingsProcessor();
  // No recorded reference laps in a fixture window, so gaps fall back to the
  // class-estimate path — which is what the app itself does early in a session.
  const noReferenceLaps: ReferenceLapSource = {
    snapshot: () => ({
      bestLaps: [],
      persistedLaps: [],
      sessionNum: null,
      version: 0,
    }),
  };
  const relativeGaps = new RelativeGapProcessor(noReferenceLaps);
  standings.init(session);
  relativeGaps.init?.(session);

  const published: Partial<ChannelPayloads> = {};
  const listeners = new Map<string, ((payload: unknown) => void)[]>();

  const publish = <K extends ChannelName>(
    channel: K,
    payload: ChannelPayloads[K]
  ) => {
    published[channel] = payload;
    listeners.get(channel)?.forEach((listener) => listener(payload));
  };

  const seekTo = (frameIndex: number) => {
    const frame = fixture.frames[frameIndex];
    if (!frame) throw new Error(`fixture has no frame ${frameIndex}`);
    const telemetry = toTelemetry(frame);
    standings.onFrame(telemetry);
    relativeGaps.onFrame(telemetry);
    publish('standings.snapshot', standings.snapshot());
    publish('relative-gaps.snapshot', relativeGaps.snapshot());
  };

  // Wind through every frame so the hooks see a settled session rather than a
  // cold first tick — several values only appear once a lap has been observed.
  fixture.frames.forEach((_, index) => seekTo(index));

  const bridge: ChannelBridge = {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void
    ) => {
      const existing = listeners.get(channel) ?? [];
      listeners.set(channel, [
        ...existing,
        callback as (payload: unknown) => void,
      ]);
      const snapshot = published[channel];
      if (snapshot !== undefined) callback(snapshot as ChannelPayloads[K]);
      return () => {
        listeners.set(
          channel,
          (listeners.get(channel) ?? []).filter((l) => l !== callback)
        );
      };
    },
  };
  window.channelBridge = bridge;
  useSessionStore.setState({ session });

  const dashboard = options.dashboard ?? (defaultDashboard as DashboardLayout);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DashboardProvider bridge={dashboardBridgeStub(dashboard)}>
      {children}
    </DashboardProvider>
  );

  return {
    wrapper,
    seekTo,
    focusCarIdx: standings.snapshot().focusCarIdx ?? -1,
  };
};
