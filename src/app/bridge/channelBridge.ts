import { ipcMain, BrowserWindow } from 'electron';
import type {
  ChannelDefinition,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';
import { channelRegistry } from '@irdashies/types';

export const CHANNEL_SUBSCRIBE = 'channels:subscribe';
export const CHANNEL_UNSUBSCRIBE = 'channels:unsubscribe';
export const CHANNEL_DELIVERY = 'channels:delivery';

interface RendererTarget {
  readonly id: number;
  isDestroyed(): boolean;
  isVisible(): boolean;
  send(channel: string, name: string, payload: unknown): void;
}

interface TimerHandle {
  cancel(): void;
}

interface ChannelBusOptions {
  registry?: Readonly<Record<string, ChannelDefinition>>;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  onPublish?: (rendererId: number, channel: string) => void;
  onDeliver?: (rendererId: number, channel: string) => void;
}

type SubscriberCountListener = (channel: string, count: number) => void;

interface Subscription {
  target: RendererTarget;
  rateHz: number | 'event';
  lastDeliveredAt?: number;
  pending?: unknown;
  timer?: TimerHandle;
}

export interface ChannelBusMetricsSnapshot {
  publications: Readonly<Record<string, number>>;
  deliveries: Readonly<Record<string, number>>;
}

const systemSchedule = (callback: () => void, delayMs: number): TimerHandle => {
  const timeout = setTimeout(callback, delayMs);
  return { cancel: () => clearTimeout(timeout) };
};

export class ChannelBus {
  private readonly registry: Readonly<Record<string, ChannelDefinition>>;
  private readonly now: () => number;
  private readonly schedule: (
    callback: () => void,
    delayMs: number
  ) => TimerHandle;
  private readonly onPublish?: (rendererId: number, channel: string) => void;
  private readonly onDeliver?: (rendererId: number, channel: string) => void;
  private readonly subscriptions = new Map<string, Map<number, Subscription>>();
  private readonly latestSnapshots = new Map<string, unknown>();
  private readonly publicationCounts = new Map<string, number>();
  private readonly deliveryCounts = new Map<string, number>();
  private readonly subscriberCountListeners =
    new Set<SubscriberCountListener>();

  constructor(options: ChannelBusOptions = {}) {
    this.registry = options.registry ?? channelRegistry;
    this.now = options.now ?? (() => performance.now());
    this.schedule = options.schedule ?? systemSchedule;
    this.onPublish = options.onPublish;
    this.onDeliver = options.onDeliver;
  }

  subscribe(target: RendererTarget, channel: string, rate?: number): void {
    const definition = this.definition(channel);
    const rateHz = this.validateRate(definition, rate);
    if (target.isDestroyed()) {
      this.remove(channel, target.id);
      return;
    }
    const existing = this.subscriptions.get(channel)?.get(target.id);
    if (existing) {
      existing.target = target;
      existing.rateHz = rateHz;
      existing.timer?.cancel();
      existing.timer = undefined;
      if (existing.pending !== undefined && target.isVisible()) {
        this.queueDelivery(channel, existing, existing.pending);
      }
      return;
    }
    this.remove(channel, target.id);
    let subscribers = this.subscriptions.get(channel);
    if (!subscribers) {
      subscribers = new Map();
      this.subscriptions.set(channel, subscribers);
    }
    const subscription: Subscription = { target, rateHz };
    subscribers.set(target.id, subscription);
    this.notifySubscriberCount(channel);

    if (definition.kind === 'snapshot' && this.latestSnapshots.has(channel)) {
      const latest = this.latestSnapshots.get(channel);
      if (target.isVisible()) {
        this.deliver(channel, subscription, latest);
      } else {
        subscription.pending = latest;
      }
    }
  }

  unsubscribe(rendererId: number, channel: string): void {
    this.definition(channel);
    this.remove(channel, rendererId);
  }

  removeRenderer(rendererId: number): void {
    for (const channel of this.subscriptions.keys()) {
      this.remove(channel, rendererId);
    }
  }

  publish<K extends ChannelName>(channel: K, payload: ChannelPayloads[K]): void;
  publish(channel: string, payload: unknown): void;
  publish(channel: string, payload: unknown): void {
    const definition = this.definition(channel);
    if (definition.kind === 'snapshot') {
      this.latestSnapshots.set(channel, payload);
    }

    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;
    for (const [rendererId, subscription] of subscribers) {
      this.onPublish?.(rendererId, channel);
      this.increment(this.publicationCounts, rendererId, channel);
      if (subscription.target.isDestroyed()) {
        this.remove(channel, rendererId);
        continue;
      }
      if (!subscription.target.isVisible()) {
        if (definition.kind === 'snapshot') subscription.pending = payload;
        continue;
      }
      this.queueDelivery(channel, subscription, payload);
    }
  }

  rendererBecameVisible(rendererId: number): void {
    for (const [channel, subscribers] of this.subscriptions) {
      const subscription = subscribers.get(rendererId);
      if (
        subscription?.pending === undefined ||
        subscription.target.isDestroyed() ||
        !subscription.target.isVisible()
      ) {
        continue;
      }
      this.queueDelivery(channel, subscription, subscription.pending);
    }
  }

  subscriberCount(channel: string): number {
    return this.subscriptions.get(channel)?.size ?? 0;
  }

  onSubscriberCountChanged(listener: SubscriberCountListener): () => void {
    this.subscriberCountListeners.add(listener);
    return () => this.subscriberCountListeners.delete(listener);
  }

  metricsSnapshot(): ChannelBusMetricsSnapshot {
    return {
      publications: Object.fromEntries(this.publicationCounts),
      deliveries: Object.fromEntries(this.deliveryCounts),
    };
  }

  dispose(): void {
    for (const subscribers of this.subscriptions.values()) {
      for (const subscription of subscribers.values()) {
        subscription.timer?.cancel();
      }
    }
    this.subscriptions.clear();
  }

  private definition(channel: string): ChannelDefinition {
    const definition = this.registry[channel];
    if (!definition) throw new Error(`Unknown channel: ${channel}`);
    return definition;
  }

  private validateRate(
    definition: ChannelDefinition,
    requested?: number
  ): number | 'event' {
    if (definition.kind === 'event') {
      if (requested !== undefined) {
        throw new Error('Event channels do not accept a requested rate');
      }
      return 'event';
    }
    const rate = requested ?? definition.defaultRateHz;
    if (!Number.isFinite(rate) || rate <= 0 || rate > definition.maxRateHz) {
      throw new Error(`Invalid channel rate: ${String(rate)}`);
    }
    return rate;
  }

  private queueDelivery(
    channel: string,
    subscription: Subscription,
    payload: unknown
  ): void {
    if (subscription.rateHz === 'event') {
      this.deliver(channel, subscription, payload);
      return;
    }
    const intervalMs = 1000 / subscription.rateHz;
    const now = this.now();
    const elapsed =
      subscription.lastDeliveredAt === undefined
        ? intervalMs
        : now - subscription.lastDeliveredAt;
    if (elapsed >= intervalMs) {
      subscription.timer?.cancel();
      subscription.timer = undefined;
      subscription.pending = undefined;
      this.deliver(channel, subscription, payload);
      return;
    }
    subscription.pending = payload;
    if (subscription.timer) return;
    subscription.timer = this.schedule(() => {
      subscription.timer = undefined;
      const pending = subscription.pending;
      if (pending === undefined) return;
      if (subscription.target.isDestroyed()) {
        subscription.pending = undefined;
        return;
      }
      if (!subscription.target.isVisible()) return;
      subscription.pending = undefined;
      this.deliver(channel, subscription, pending);
    }, intervalMs - elapsed);
  }

  private deliver(
    channel: string,
    subscription: Subscription,
    payload: unknown
  ): void {
    subscription.target.send(CHANNEL_DELIVERY, channel, payload);
    subscription.lastDeliveredAt = this.now();
    this.onDeliver?.(subscription.target.id, channel);
    this.increment(this.deliveryCounts, subscription.target.id, channel);
  }

  private increment(
    counters: Map<string, number>,
    rendererId: number,
    channel: string
  ): void {
    const key = `${rendererId}:${channel}`;
    counters.set(key, (counters.get(key) ?? 0) + 1);
  }

  private remove(channel: string, rendererId: number): void {
    const subscribers = this.subscriptions.get(channel);
    const subscription = subscribers?.get(rendererId);
    subscription?.timer?.cancel();
    const removed = subscribers?.delete(rendererId) ?? false;
    if (subscribers?.size === 0) this.subscriptions.delete(channel);
    if (removed) this.notifySubscriberCount(channel);
  }

  private notifySubscriberCount(channel: string): void {
    const count = this.subscriberCount(channel);
    this.subscriberCountListeners.forEach((listener) =>
      listener(channel, count)
    );
  }
}

const targetFor = (sender: Electron.WebContents): RendererTarget => ({
  id: sender.id,
  isDestroyed: () => sender.isDestroyed(),
  isVisible: () => BrowserWindow.fromWebContents(sender)?.isVisible() ?? false,
  send: (channel, name, payload) => sender.send(channel, name, payload),
});

export const setupChannelBridge = (bus: ChannelBus): (() => void) => {
  const rendererCleanup = new Map<number, () => void>();
  ipcMain.handle(
    CHANNEL_SUBSCRIBE,
    (event, channel: unknown, rate: unknown) => {
      if (typeof channel !== 'string') throw new Error('Invalid channel name');
      if (rate !== undefined && typeof rate !== 'number') {
        throw new Error('Invalid channel rate');
      }
      if (!rendererCleanup.has(event.sender.id)) {
        const window = BrowserWindow.fromWebContents(event.sender);
        const onShow = () => bus.rendererBecameVisible(event.sender.id);
        window?.on('show', onShow);
        const cleanup = () => {
          window?.removeListener('show', onShow);
          rendererCleanup.delete(event.sender.id);
          bus.removeRenderer(event.sender.id);
        };
        rendererCleanup.set(event.sender.id, cleanup);
        event.sender.once('destroyed', () => {
          cleanup();
        });
      }
      bus.subscribe(targetFor(event.sender), channel, rate);
    }
  );
  ipcMain.handle(CHANNEL_UNSUBSCRIBE, (event, channel: unknown) => {
    if (typeof channel !== 'string') throw new Error('Invalid channel name');
    bus.unsubscribe(event.sender.id, channel);
  });
  return () => {
    ipcMain.removeHandler(CHANNEL_SUBSCRIBE);
    ipcMain.removeHandler(CHANNEL_UNSUBSCRIBE);
    for (const cleanup of rendererCleanup.values()) cleanup();
    rendererCleanup.clear();
    bus.dispose();
  };
};
