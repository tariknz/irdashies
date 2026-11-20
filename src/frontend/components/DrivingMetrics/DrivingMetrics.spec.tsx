import { Profiler, type ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
  TrackStateSnapshot,
} from '@irdashies/types';
import { WidgetRuntimeProvider } from '../../widgetRuntime';
import {
  AccelerationTimer,
  CruiseOdometer,
  FrictionCircle,
  SteeringMeter,
} from './DrivingMetrics';

const frame = {
  background: { opacity: 80 },
  showOnlyWhenOnTrack: false,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const dashboard = {
  widgets: [
    {
      id: 'accelerationtimer',
      config: { ...frame, ranges: [{ fromKph: 0, toKph: 100 }] },
    },
    { id: 'cruiseodometer', config: { ...frame, distanceUnit: 'km' } },
    { id: 'frictioncircle', config: frame },
    { id: 'steeringmeter', config: frame },
  ],
};

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ currentDashboard: dashboard }),
  useTrackLength: () => 5000,
}));

type Listener = (payload: ChannelPayloads[ChannelName]) => void;

const createBridge = () => {
  const listeners = new Map<ChannelName, Set<Listener>>();
  const rates = new Map<ChannelName, number | undefined>();
  const bridge: ChannelBridge = {
    subscribe: (channel, callback, requestedRateHz) => {
      rates.set(channel, requestedRateHz);
      const set = listeners.get(channel) ?? new Set<Listener>();
      set.add(callback as Listener);
      listeners.set(channel, set);
      return () => {
        set.delete(callback as Listener);
      };
    },
  };
  const publish = <K extends ChannelName>(
    channel: K,
    payload: ChannelPayloads[K]
  ) =>
    act(() => {
      for (const listener of listeners.get(channel) ?? []) listener(payload);
    });
  return { bridge, publish, rates };
};

const trackState = (
  overrides: Partial<TrackStateSnapshot>
): TrackStateSnapshot =>
  ({
    isOnTrack: true,
    notInSession: false,
    sessionNum: 0,
    sessionTime: 0,
    speed: 0,
    lapDistPct: 0,
    version: 1,
    ...overrides,
  }) as TrackStateSnapshot;

const renderCounted = (children: ReactNode) => {
  const commits = { count: 0 };
  const view = render(
    <Profiler id="widget" onRender={() => (commits.count += 1)}>
      {children}
    </Profiler>
  );
  return { ...view, commits };
};

let source: ReturnType<typeof createBridge>;
let previousBridge: ChannelBridge;

beforeEach(() => {
  previousBridge = window.channelBridge;
  source = createBridge();
  window.channelBridge = source.bridge;
});

afterEach(() => {
  window.channelBridge = previousBridge;
});

describe('AccelerationTimer', () => {
  it('asks for the car-dynamics rate its runtime definition sets', () => {
    render(
      <WidgetRuntimeProvider widgetType="accelerationtimer">
        <AccelerationTimer />
      </WidgetRuntimeProvider>
    );
    expect(source.rates.get('car-dynamics.snapshot')).toBe(60);
    expect(source.rates.get('driver-controls.snapshot')).toBe(25);
  });

  it('stays still while parked and renders only while a run is shown', () => {
    const { container, commits } = renderCounted(<AccelerationTimer />);
    source.publish('driver-controls.snapshot', {
      gear: 1,
      rpm: 900,
      version: 1,
    });
    source.publish('car-dynamics.snapshot', {
      speed: 0,
      sessionTime: 100,
      version: 1,
    });
    const parkedCommits = commits.count;

    for (let index = 1; index <= 60; index++) {
      source.publish('driver-controls.snapshot', {
        gear: 1,
        rpm: 900 + index,
        version: index + 1,
      });
      source.publish('car-dynamics.snapshot', {
        speed: 0,
        sessionTime: 100 + index / 60,
        version: index + 1,
      });
    }
    expect(commits.count).toBe(parkedCommits);
    expect(container.textContent).toContain('—');

    const start = 101;
    let runFrames = 0;
    for (let index = 0; index <= 180; index++) {
      const speedKph = Math.min(120, 50 * (index / 60));
      if (speedKph < 120) runFrames += 1;
      source.publish('car-dynamics.snapshot', {
        speed: speedKph / 3.6,
        sessionTime: start + index / 60,
        version: 100 + index,
      });
    }

    expect(container.textContent).toContain('1.99 s');
    expect(commits.count - parkedCommits).toBeLessThanOrEqual(runFrames);
    const finishedCommits = commits.count;
    for (let index = 181; index <= 240; index++) {
      source.publish('car-dynamics.snapshot', {
        speed: 120 / 3.6,
        sessionTime: start + index / 60,
        version: 100 + index,
      });
    }
    expect(commits.count).toBe(finishedCommits);
  });
});

describe('CruiseOdometer', () => {
  it('renders only when a shown distance changes', () => {
    const { container, commits } = renderCounted(<CruiseOdometer />);
    source.publish(
      'track-state.snapshot',
      trackState({ sessionTime: 100, lapDistPct: 0.1 })
    );
    const parkedCommits = commits.count;
    for (let index = 1; index <= 50; index++) {
      source.publish(
        'track-state.snapshot',
        trackState({ sessionTime: 100 + index * 0.04, lapDistPct: 0.1 })
      );
    }
    expect(commits.count).toBe(parkedCommits);
    expect(container.textContent).toContain('0.50 km');
    expect(container.textContent).toContain('0.00 km');

    for (let index = 1; index <= 25; index++) {
      source.publish(
        'track-state.snapshot',
        trackState({
          sessionTime: 102 + index * 0.04,
          speed: 50,
          lapDistPct: 0.1 + index * 0.0004,
        })
      );
    }
    expect(container.textContent).toContain('0.55 km');
    expect(container.textContent).toContain('0.05 km');
    expect(commits.count - parkedCommits).toBeLessThanOrEqual(10);
  });
});

describe('SteeringMeter', () => {
  it('ignores driver-control changes that leave the wheel still', () => {
    const { container, commits } = renderCounted(<SteeringMeter />);
    source.publish('car-condition.snapshot', {
      steeringWheelAngleMax: 7.85,
      version: 1,
    });
    source.publish('driver-controls.snapshot', {
      steeringWheelAngle: 0.5,
      rpm: 3000,
      version: 1,
    });
    expect(container.textContent).toContain('-29°');
    const stillCommits = commits.count;

    for (let index = 1; index <= 30; index++) {
      source.publish('driver-controls.snapshot', {
        steeringWheelAngle: 0.5,
        rpm: 3000 + index * 10,
        throttle: index / 30,
        version: index + 1,
      });
    }
    expect(commits.count).toBe(stillCommits);

    source.publish('driver-controls.snapshot', {
      steeringWheelAngle: -0.5,
      rpm: 3400,
      version: 40,
    });
    expect(commits.count).toBe(stillCommits + 1);
    expect(container.textContent).toContain('29°');
    expect(container.textContent).not.toContain('-29°');
  });
});

describe('FrictionCircle', () => {
  it('ignores car-dynamics changes that leave the acceleration alone', () => {
    const { container, commits } = renderCounted(<FrictionCircle />);
    source.publish('car-dynamics.snapshot', {
      lateralAccel: 4.9,
      longitudinalAccel: -9.80665,
      speed: 40,
      sessionTime: 100,
      version: 1,
    });
    expect(container.textContent).toContain('brake 1.00 g');
    const steadyCommits = commits.count;

    for (let index = 1; index <= 30; index++) {
      source.publish('car-dynamics.snapshot', {
        lateralAccel: 4.9,
        longitudinalAccel: -9.80665,
        speed: 40 + index,
        sessionTime: 100 + index / 60,
        version: index + 1,
      });
    }
    expect(commits.count).toBe(steadyCommits);
  });
});
