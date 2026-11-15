import { act, cleanup, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  Session,
  SessionTimingSnapshot,
  TrackStateSnapshot,
} from '@irdashies/types';
import { SessionState } from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import { TitleBar } from './TitleBar';

vi.mock('@irdashies/domain', () => ({
  useHighlightColor: () => 0xffffff,
}));

const createBridge = () => {
  const listeners = new Map<
    ChannelName,
    (payload: ChannelPayloads[ChannelName]) => void
  >();
  const activeChannels = new Set<ChannelName>();
  const subscribe = vi.fn(
    <K extends ChannelName>(
      channel: K,
      callback: (payload: ChannelPayloads[K]) => void
    ) => {
      listeners.set(
        channel,
        callback as (payload: ChannelPayloads[ChannelName]) => void
      );
      activeChannels.add(channel);
      return () => {
        if (listeners.get(channel) === callback) {
          listeners.delete(channel);
          activeChannels.delete(channel);
        }
      };
    }
  );

  return {
    bridge: { subscribe } as unknown as ChannelBridge,
    subscribe,
    activeChannels,
    publish<K extends ChannelName>(channel: K, payload: ChannelPayloads[K]) {
      listeners.get(channel)?.(payload);
    },
  };
};

const trackSnapshot = (
  overrides: Partial<TrackStateSnapshot> = {}
): TrackStateSnapshot =>
  ({
    focusCarIdx: 0,
    carIdxLapDistPct: [],
    carIdxOnPitRoad: [],
    carIdxTrackSurface: [],
    carIdxClassPosition: [],
    carLeftRight: 0,
    isOnTrack: true,
    dataStale: false,
    notInSession: false,
    outOfCar: false,
    playerCarInPitStall: false,
    playerTrackSurface: 0,
    onPitRoad: false,
    isInGarage: false,
    isGarageVisible: false,
    isReplayPlaying: false,
    sessionTime: 0,
    sessionState: SessionState.Racing,
    sessionFlags: 0,
    speed: 0,
    displayUnits: 0,
    pitSpeedLimiterToggle: false,
    pitstopActive: false,
    engineWarnings: 0,
    lapDistPct: 0,
    sessionNum: 0,
    version: 0,
    ...overrides,
  }) as TrackStateSnapshot;

const timingSnapshot = (
  overrides: Partial<SessionTimingSnapshot> = {}
): SessionTimingSnapshot => ({
  sessionType: 'Race',
  state: SessionState.Racing,
  currentLap: 1,
  totalLaps: 10,
  time: 0,
  timeTotal: 0,
  timeRemaining: 0,
  greenFlagTimestamp: 0,
  isFixedLapRace: true,
  totalRaceLaps: 10,
  totalRaceTime: 0,
  adjustedRaceTime: 0,
  sessionNum: 0,
  version: 0,
  ...overrides,
});

const setSessionType = (sessionType: string) => {
  useSessionStore.getState().setSession({
    SessionInfo: {
      Sessions: [{ SessionNum: 0, SessionType: sessionType }],
    },
  } as Session);
};

const previousBridge = window.channelBridge;

afterEach(() => {
  cleanup();
  useSessionStore.getState().resetSession();
  window.channelBridge = previousBridge;
});

describe('TitleBar telemetry demand', () => {
  it('does not subscribe while the title is disabled', () => {
    const source = createBridge();
    window.channelBridge = source.bridge;

    const view = render(
      <TitleBar
        titleBarSettings={{ enabled: false, progressBar: { enabled: true } }}
      />
    );

    expect(view.container).toBeEmptyDOMElement();
    expect(source.subscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe to race timing when progress is disabled', () => {
    const source = createBridge();
    window.channelBridge = source.bridge;
    setSessionType('Race');

    render(
      <TitleBar
        titleBarSettings={{ enabled: true, progressBar: { enabled: false } }}
      />
    );
    act(() => source.publish('track-state.snapshot', trackSnapshot()));

    expect(screen.getByText('Race')).toBeInTheDocument();
    expect(source.subscribe.mock.calls.map(([channel]) => channel)).toEqual([
      'track-state.snapshot',
    ]);
    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.9, version: 1 })
      )
    );
    expect(
      source.subscribe.mock.calls.map(([channel]) => channel)
    ).not.toContain('session-timing.snapshot');
  });

  it('updates race progress on movement and seek, then releases timing demand outside Race', () => {
    const source = createBridge();
    window.channelBridge = source.bridge;
    setSessionType('Race');

    const onRender = vi.fn();
    render(
      <Profiler id="title-bar" onRender={onRender}>
        <TitleBar
          titleBarSettings={{ enabled: true, progressBar: { enabled: true } }}
        />
      </Profiler>
    );
    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.25 })
      )
    );
    act(() => source.publish('session-timing.snapshot', timingSnapshot()));

    const progress = () =>
      document.querySelector<HTMLDivElement>(
        '.absolute.inset-x-3.inset-y-2 > div'
      );
    const progressWidth = () =>
      Number.parseFloat(progress()?.style.width ?? 'NaN');
    expect(progressWidth()).toBeCloseTo(2.5);
    expect(source.subscribe.mock.calls.map(([channel]) => channel)).toEqual(
      expect.arrayContaining([
        'track-state.snapshot',
        'session-timing.snapshot',
      ])
    );

    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: Number.NaN, version: 1 })
      )
    );
    expect(progress()).toBeNull();

    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.7, version: 2 })
      )
    );
    expect(progressWidth()).toBeCloseTo(7);

    // A replay seek backwards changes visible progress immediately.
    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.1, isReplayPlaying: false, version: 3 })
      )
    );
    expect(progressWidth()).toBeCloseTo(1);

    act(() =>
      source.publish(
        'session-timing.snapshot',
        timingSnapshot({ state: SessionState.Checkered, version: 1 })
      )
    );
    expect(progressWidth()).toBe(100);

    act(() => setSessionType('Practice'));
    expect(screen.getByText('Practice')).toBeInTheDocument();
    expect(source.activeChannels).not.toContain('session-timing.snapshot');
    expect(
      source.subscribe.mock.calls.filter(
        ([channel]) => channel === 'session-timing.snapshot'
      )
    ).toHaveLength(1);
    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.8, version: 4 })
      )
    );
    expect(progress()).toBeNull();
  });

  it('suspends lap-position renders when its value cannot affect progress', () => {
    const source = createBridge();
    window.channelBridge = source.bridge;
    setSessionType('Race');
    const onRender = vi.fn();

    render(
      <Profiler id="title-bar" onRender={onRender}>
        <TitleBar
          titleBarSettings={{ enabled: true, progressBar: { enabled: true } }}
        />
      </Profiler>
    );
    act(() =>
      source.publish('track-state.snapshot', trackSnapshot({ lapDistPct: 0.2 }))
    );
    act(() =>
      source.publish(
        'session-timing.snapshot',
        timingSnapshot({ state: SessionState.Warmup })
      )
    );

    const commitsAfterWarmup = onRender.mock.calls.length;
    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.6, version: 1 })
      )
    );
    expect(onRender).toHaveBeenCalledTimes(commitsAfterWarmup);

    act(() =>
      source.publish(
        'session-timing.snapshot',
        timingSnapshot({ state: SessionState.Racing, totalRaceLaps: 0 })
      )
    );
    const commitsWithoutLapEstimate = onRender.mock.calls.length;
    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.4, version: 2 })
      )
    );
    expect(onRender).toHaveBeenCalledTimes(commitsWithoutLapEstimate);

    act(() =>
      source.publish(
        'session-timing.snapshot',
        timingSnapshot({ state: SessionState.Racing, totalRaceLaps: 10 })
      )
    );
    expect(
      Number.parseFloat(
        document.querySelector<HTMLDivElement>(
          '.absolute.inset-x-3.inset-y-2 > div'
        )?.style.width ?? 'NaN'
      )
    ).toBeCloseTo(4);

    act(() =>
      source.publish(
        'session-timing.snapshot',
        timingSnapshot({ state: SessionState.Checkered, version: 1 })
      )
    );
    const commitsAfterCheckered = onRender.mock.calls.length;
    act(() =>
      source.publish(
        'track-state.snapshot',
        trackSnapshot({ lapDistPct: 0.8, version: 3 })
      )
    );
    expect(onRender).toHaveBeenCalledTimes(commitsAfterCheckered);

    // Resuming after a paused replay seek reads the latest cached position.
    act(() =>
      source.publish(
        'session-timing.snapshot',
        timingSnapshot({ state: SessionState.Racing, version: 2 })
      )
    );
    expect(
      Number.parseFloat(
        document.querySelector<HTMLDivElement>(
          '.absolute.inset-x-3.inset-y-2 > div'
        )?.style.width ?? 'NaN'
      )
    ).toBeCloseTo(8);
  });
});
