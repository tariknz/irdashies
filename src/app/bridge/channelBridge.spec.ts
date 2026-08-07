import { describe, expect, it, vi } from 'vitest';
import type { ChannelDefinition } from '@irdashies/types';
import { CHANNEL_DELIVERY, ChannelBus } from './channelBridge';

class FakeClock {
  now = 0;
  private tasks: {
    at: number;
    callback: () => void;
    cancelled: boolean;
  }[] = [];

  schedule = (callback: () => void, delayMs: number) => {
    const task = { at: this.now + delayMs, callback, cancelled: false };
    this.tasks.push(task);
    return { cancel: () => (task.cancelled = true) };
  };

  advance(ms: number): void {
    this.now += ms;
    const due = this.tasks
      .filter((task) => !task.cancelled && task.at <= this.now)
      .sort((a, b) => a.at - b.at);
    this.tasks = this.tasks.filter((task) => !due.includes(task));
    for (const task of due) task.callback();
  }
}

const registry: Readonly<Record<string, ChannelDefinition>> = {
  snapshot: { kind: 'snapshot', defaultRateHz: 10, maxRateHz: 60 },
  event: { kind: 'event' },
};

const createTarget = (id = 1) => ({
  id,
  destroyed: false,
  visible: true,
  send: vi.fn(),
  isDestroyed() {
    return this.destroyed;
  },
  isVisible() {
    return this.visible;
  },
});

const createBus = (clock = new FakeClock()) => ({
  clock,
  bus: new ChannelBus({
    registry,
    now: () => clock.now,
    schedule: clock.schedule,
  }),
});

describe('ChannelBus', () => {
  it('rejects unknown channels and invalid rates', () => {
    const { bus } = createBus();
    const target = createTarget();

    expect(() => bus.subscribe(target, 'missing')).toThrow('Unknown channel');
    expect(() => bus.subscribe(target, 'snapshot', 0)).toThrow(
      'Invalid channel rate'
    );
    expect(() => bus.subscribe(target, 'snapshot', 61)).toThrow(
      'Invalid channel rate'
    );
    expect(() => bus.subscribe(target, 'event', 10)).toThrow(
      'Event channels do not accept'
    );
  });

  it('coalesces snapshot updates and trails with the latest value', () => {
    const { bus, clock } = createBus();
    const target = createTarget();
    bus.subscribe(target, 'snapshot', 10);

    bus.publish('snapshot', { value: 1 });
    clock.advance(20);
    bus.publish('snapshot', { value: 2 });
    clock.advance(20);
    bus.publish('snapshot', { value: 3 });

    expect(target.send).toHaveBeenCalledTimes(1);
    clock.advance(60);
    expect(target.send).toHaveBeenLastCalledWith(CHANNEL_DELIVERY, 'snapshot', {
      value: 3,
    });
    expect(target.send).toHaveBeenCalledTimes(2);
  });

  it('seeds snapshot subscribers but does not replay events', () => {
    const { bus } = createBus();
    bus.publish('snapshot', { value: 7 });
    bus.publish('event', { type: 'old' });
    const target = createTarget();

    bus.subscribe(target, 'snapshot');
    bus.subscribe(target, 'event');

    expect(target.send).toHaveBeenCalledOnce();
    expect(target.send).toHaveBeenCalledWith(CHANNEL_DELIVERY, 'snapshot', {
      value: 7,
    });
  });

  it('can discard a cached snapshot without affecting subscribers', () => {
    const { bus } = createBus();
    bus.publish('snapshot', { value: 7 });
    bus.clearSnapshot('snapshot');
    const target = createTarget();
    bus.subscribe(target, 'snapshot');

    expect(target.send).not.toHaveBeenCalled();
    expect(() => bus.clearSnapshot('event')).toThrow(
      'Cannot clear event channel'
    );
  });

  it('suppresses hidden renderers and removes destroyed renderers', () => {
    const { bus } = createBus();
    const target = createTarget();
    bus.subscribe(target, 'event');

    target.visible = false;
    bus.publish('event', { type: 'hidden' });
    expect(target.send).not.toHaveBeenCalled();

    target.visible = true;
    target.destroyed = true;
    bus.publish('event', { type: 'destroyed' });
    expect(bus.subscriberCount('event')).toBe(0);
  });

  it('cancels pending delivery on unsubscribe and renderer removal', () => {
    const { bus, clock } = createBus();
    const first = createTarget(1);
    const second = createTarget(2);
    bus.subscribe(first, 'snapshot', 10);
    bus.subscribe(second, 'snapshot', 10);
    bus.publish('snapshot', 1);
    bus.publish('snapshot', 2);

    bus.unsubscribe(first.id, 'snapshot');
    bus.removeRenderer(second.id);
    clock.advance(100);

    expect(first.send).toHaveBeenCalledTimes(1);
    expect(second.send).toHaveBeenCalledTimes(1);
    expect(bus.subscriberCount('snapshot')).toBe(0);
  });

  it('tracks publication and delivery counts per renderer and channel', () => {
    const { bus } = createBus();
    const target = createTarget(9);
    bus.subscribe(target, 'event');
    bus.publish('event', { type: 'first' });
    bus.publish('event', { type: 'second' });

    expect(bus.metricsSnapshot()).toEqual({
      publications: { '9:event': 2 },
      deliveries: { '9:event': 2 },
    });
  });

  it('reschedules a pending snapshot when the requested rate changes', () => {
    const { bus, clock } = createBus();
    const target = createTarget();
    bus.subscribe(target, 'snapshot', 5);
    bus.publish('snapshot', 1);
    clock.advance(10);
    bus.publish('snapshot', 2);

    bus.subscribe(target, 'snapshot', 20);
    clock.advance(40);
    expect(target.send).toHaveBeenCalledTimes(2);
    expect(target.send).toHaveBeenLastCalledWith(
      CHANNEL_DELIVERY,
      'snapshot',
      2
    );
  });

  it('retains the latest pending snapshot until a hidden renderer is shown', () => {
    const { bus, clock } = createBus();
    const target = createTarget();
    bus.subscribe(target, 'snapshot', 10);
    bus.publish('snapshot', 1);
    clock.advance(20);
    bus.publish('snapshot', 2);

    target.visible = false;
    clock.advance(80);
    bus.publish('snapshot', 3);
    expect(target.send).toHaveBeenCalledTimes(1);

    target.visible = true;
    bus.rendererBecameVisible(target.id);
    expect(target.send).toHaveBeenCalledTimes(2);
    expect(target.send).toHaveBeenLastCalledWith(
      CHANNEL_DELIVERY,
      'snapshot',
      3
    );
  });
});
