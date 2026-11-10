import { describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import type { ChannelBus } from './bridge/channelBus';
import { needsLapHistory, watchLapHistoryDemand } from './lapHistoryDemand';

const widget = (
  id: string,
  enabled: boolean,
  extra: Partial<DashboardWidget> = {}
): DashboardWidget => ({
  id,
  enabled,
  layout: { x: 0, y: 0, width: 100, height: 100 },
  ...extra,
});

const layout = (...widgets: DashboardWidget[]): DashboardLayout => ({
  widgets,
});

describe('needsLapHistory', () => {
  it('is false with no layout or no consumers', () => {
    expect(needsLapHistory(undefined)).toBe(false);
    expect(needsLapHistory(layout())).toBe(false);
    expect(needsLapHistory(layout(widget('relative', true)))).toBe(false);
    expect(needsLapHistory(layout(widget('unknown', true)))).toBe(false);
  });

  it('is true for an enabled Gantry', () => {
    expect(needsLapHistory(layout(widget('gantry', true)))).toBe(true);
    expect(needsLapHistory(layout(widget('gantry', false)))).toBe(false);
  });

  it('is true for an enabled Battle without the Gantry', () => {
    expect(
      needsLapHistory(layout(widget('battle', true), widget('gantry', false)))
    ).toBe(true);
    expect(needsLapHistory(layout(widget('battle', false)))).toBe(false);
  });

  it('matches a widget copy by its type', () => {
    const copy = widget('battle-2', true, { type: 'battle' });
    expect(needsLapHistory(layout(copy))).toBe(true);
  });
});

type CountListener = Parameters<ChannelBus['onSubscriberCountChanged']>[0];

const fakeBus = (initialCount = 0) => {
  let count = initialCount;
  const listeners = new Set<CountListener>();
  return {
    subscriberCount: () => count,
    onSubscriberCountChanged: (listener: CountListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setCount: (channel: string, next: number) => {
      count = next;
      listeners.forEach((listener) => listener(channel, next, next));
    },
    listenerCount: () => listeners.size,
  };
};

const fakeDashboardEvents = () => {
  const listeners = new Set<(layout: DashboardLayout) => void>();
  return {
    onDashboardUpdated: (listener: (layout: DashboardLayout) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (next: DashboardLayout) =>
      listeners.forEach((listener) => listener(next)),
    listenerCount: () => listeners.size,
  };
};

describe('watchLapHistoryDemand', () => {
  it('reports the dashboard demand straight away', () => {
    const onChange = vi.fn();
    watchLapHistoryDemand(
      fakeBus(),
      layout(widget('battle', true)),
      fakeDashboardEvents().onDashboardUpdated,
      onChange
    );
    expect(onChange.mock.calls).toEqual([[true]]);
  });

  it('records for a subscriber while no enabled widget needs it', () => {
    // A browser source showing a Battle that is disabled on the desktop.
    const bus = fakeBus();
    const onChange = vi.fn();
    watchLapHistoryDemand(
      bus,
      layout(widget('battle', false)),
      fakeDashboardEvents().onDashboardUpdated,
      onChange
    );

    bus.setCount('lap-history.snapshot', 1);
    bus.setCount('standings.snapshot', 0);
    bus.setCount('lap-history.snapshot', 0);

    expect(onChange.mock.calls).toEqual([[false], [true], [false]]);
  });

  it('follows dashboard changes and reports only when the demand flips', () => {
    const events = fakeDashboardEvents();
    const onChange = vi.fn();
    watchLapHistoryDemand(
      fakeBus(1),
      layout(),
      events.onDashboardUpdated,
      onChange
    );

    events.emit(layout(widget('gantry', true)));
    events.emit(layout(widget('gantry', false)));

    expect(onChange.mock.calls).toEqual([[true]]);
  });

  it('stops listening once disposed', () => {
    const bus = fakeBus();
    const events = fakeDashboardEvents();
    const dispose = watchLapHistoryDemand(
      bus,
      layout(),
      events.onDashboardUpdated,
      vi.fn()
    );
    dispose();
    expect(bus.listenerCount()).toBe(0);
    expect(events.listenerCount()).toBe(0);
  });
});
