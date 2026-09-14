import type { Decorator } from '@storybook/react-vite';
import { useEffect, useRef } from 'react';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  DriverControlsSnapshot,
  LapTraceSampleSnapshot,
  TrackStateSnapshot,
} from '@irdashies/types';
import { useTelemetryStore } from '@irdashies/context';
import { trackStateStorySnapshot } from './trackStateSnapshot';

const defaultDriverControls: DriverControlsSnapshot = {
  throttle: 0,
  brake: 0,
  gear: 0,
  brakeAbsActive: false,
  version: 0,
};

const defaultLapTraceSample: LapTraceSampleSnapshot = {
  sessionTime: -1,
  lapDistPct: -1,
  throttle: 0,
  brake: 0,
  speed: 0,
  gear: 0,
  brakeAbsActive: false,
  onPitRoad: false,
  isOnTrack: true,
  sessionNum: 0,
  lastLapTime: 0,
  lapCompleted: 0,
  incidentCount: 0,
  version: 0,
};

/**
 * Republishes the mock telemetry stream driven by TelemetryDecorator onto
 * `window.channelBridge`'s `track-state.snapshot` / `driver-controls.snapshot`
 * / `lap-trace.sample` channels, live, frame by frame.
 *
 * Widgets migrated onto the channel system (LapTrace, ...) no longer read
 * from the legacy telemetry store, so `TelemetryDecorator`
 * alone leaves them frozen in Storybook. This bridges the two so the same
 * recorded-capture playback both decorators already provide keeps working
 * for channel-based widgets too, without duplicating capture data.
 */
export const LiveChannelBridgeDecorator = (): Decorator => {
  const DecoratorComponent: Decorator = (Story) => {
    const previousBridge = useRef(window.channelBridge);
    const listeners = useRef<Record<string, Set<(payload: unknown) => void>>>({
      'driver-controls.snapshot': new Set(),
      'track-state.snapshot': new Set(),
      'lap-trace.sample': new Set(),
    });
    const latestDriverControls = useRef<DriverControlsSnapshot>(
      defaultDriverControls
    );
    const latestTrackState = useRef<TrackStateSnapshot>(
      trackStateStorySnapshot
    );
    const latestLapTraceSample = useRef<LapTraceSampleSnapshot>(
      defaultLapTraceSample
    );

    const bridge: ChannelBridge = {
      subscribe: <K extends ChannelName>(
        channel: K,
        callback: (payload: ChannelPayloads[K]) => void
      ) => {
        const set = listeners.current[channel];
        if (!set) return () => undefined;
        set.add(callback as (payload: unknown) => void);
        if (channel === 'driver-controls.snapshot') {
          callback(latestDriverControls.current as ChannelPayloads[K]);
        } else if (channel === 'track-state.snapshot') {
          callback(latestTrackState.current as ChannelPayloads[K]);
        } else if (channel === 'lap-trace.sample') {
          callback(latestLapTraceSample.current as ChannelPayloads[K]);
        }
        return () => set.delete(callback as (payload: unknown) => void);
      },
    };
    window.channelBridge = bridge;

    useEffect(
      () =>
        useTelemetryStore.subscribe((state) => {
          const t = state.telemetry;
          if (!t) return;

          latestTrackState.current = {
            ...latestTrackState.current,
            lapDistPct: t.LapDistPct?.value?.[0] ?? -1,
            sessionTime: t.SessionTime?.value?.[0] ?? -1,
            speed: t.Speed?.value?.[0] ?? 0,
            onPitRoad: t.OnPitRoad?.value?.[0] ?? false,
            isOnTrack: t.IsOnTrack?.value?.[0] ?? true,
            sessionNum: t.SessionNum?.value?.[0] ?? 0,
            version: latestTrackState.current.version + 1,
          } satisfies TrackStateSnapshot;
          for (const cb of listeners.current['track-state.snapshot']) {
            cb(latestTrackState.current);
          }

          latestDriverControls.current = {
            ...latestDriverControls.current,
            throttle: t.Throttle?.value?.[0] ?? 0,
            brake: t.Brake?.value?.[0] ?? 0,
            gear: t.Gear?.value?.[0] ?? 0,
            brakeAbsActive: t.BrakeABSactive?.value?.[0] ?? false,
            version: (latestDriverControls.current.version ?? 0) + 1,
          } satisfies DriverControlsSnapshot;
          for (const cb of listeners.current['driver-controls.snapshot']) {
            cb(latestDriverControls.current);
          }

          // Same frame as the two above, which is the whole point of the
          // channel: pedals and position from one row.
          latestLapTraceSample.current = {
            sessionTime: t.SessionTime?.value?.[0] ?? -1,
            lapDistPct: t.LapDistPct?.value?.[0] ?? -1,
            // Raw pedals, matching LapTraceSampleProcessor.
            throttle: t.ThrottleRaw?.value?.[0] ?? t.Throttle?.value?.[0] ?? 0,
            brake: t.BrakeRaw?.value?.[0] ?? t.Brake?.value?.[0] ?? 0,
            speed: t.Speed?.value?.[0] ?? 0,
            gear: t.Gear?.value?.[0] ?? 0,
            brakeAbsActive: t.BrakeABSactive?.value?.[0] ?? false,
            onPitRoad: t.OnPitRoad?.value?.[0] ?? false,
            isOnTrack: t.IsOnTrack?.value?.[0] ?? true,
            sessionNum: t.SessionNum?.value?.[0] ?? 0,
            lastLapTime: t.LapLastLapTime?.value?.[0] ?? 0,
            lapCompleted: t.LapCompleted?.value?.[0] ?? 0,
            incidentCount: t.PlayerCarMyIncidentCount?.value?.[0] ?? 0,
            version: latestLapTraceSample.current.version + 1,
          } satisfies LapTraceSampleSnapshot;
          for (const cb of listeners.current['lap-trace.sample']) {
            cb(latestLapTraceSample.current);
          }
        }),
      []
    );

    useEffect(
      () => () => {
        if (previousBridge.current === undefined) {
          Reflect.deleteProperty(window, 'channelBridge');
        } else {
          window.channelBridge = previousBridge.current;
        }
      },
      []
    );

    return <Story />;
  };
  return DecoratorComponent;
};
