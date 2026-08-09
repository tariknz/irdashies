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
  deliveryEnabled?: boolean;
  onPublish?: (rendererId: number, channel: string) => void;
  onDeliver?: (rendererId: number, channel: string) => void;
}

type SubscriberCountListener = (channel: string, count: number) => void;

interface Subscription {
  target: RendererTarget;
  rateHz: number | 'event';
  active: boolean;
  lastDeliveredAt?: number;
  pending?: unknown;
  timer?: TimerHandle;
}

export interface ChannelBusMetricsSnapshot {
  publications: Readonly<Record<string, number>>;
  deliveries: Readonly<Record<string, number>>;
  channelPublications: Readonly<Record<string, number>>;
  channelDeliveries: Readonly<Record<string, number>>;
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
  private readonly deliveryEnabled: boolean;
  private readonly subscriptions = new Map<string, Map<number, Subscription>>();
  private readonly latestSnapshots = new Map<string, unknown>();
  private readonly publicationCounts = new Map<string, number>();
  private readonly deliveryCounts = new Map<string, number>();
  private readonly channelPublicationCounts = new Map<string, number>();
  private readonly channelDeliveryCounts = new Map<string, number>();
  private readonly subscriberCountListeners =
    new Set<SubscriberCountListener>();

  constructor(options: ChannelBusOptions = {}) {
    this.registry = options.registry ?? channelRegistry;
    this.now = options.now ?? (() => performance.now());
    this.schedule = options.schedule ?? systemSchedule;
    this.deliveryEnabled = options.deliveryEnabled ?? true;
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
      const active = target.isVisible();
      this.setSubscriptionActive(channel, existing, active);
      if (existing.pending !== undefined && active) {
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
    const active = target.isVisible();
    const subscription: Subscription = { target, rateHz, active };
    const hadCachedSnapshotBeforeSubscribe =
      definition.kind === 'snapshot' && this.latestSnapshots.has(channel);
    const cachedSnapshotBeforeSubscribe = this.latestSnapshots.get(channel);
    subscribers.set(target.id, subscription);
    if (active) {
      this.notifySubscriberCount(channel);
    } else if (
      definition.kind === 'snapshot' &&
      this.subscriberCount(channel) === 0
    ) {
      this.latestSnapshots.delete(channel);
    }

    if (
      this.deliveryEnabled &&
      active &&
      definition.kind === 'snapshot' &&
      hadCachedSnapshotBeforeSubscribe
    ) {
      this.deliver(channel, subscription, cachedSnapshotBeforeSubscribe);
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
    this.incrementChannel(this.channelPublicationCounts, channel);
    const subscribers = this.subscriptions.get(channel);
    const hasRegisteredSubscribers = (subscribers?.size ?? 0) > 0;
    if (
      definition.kind === 'snapshot' &&
      (!hasRegisteredSubscribers || this.subscriberCount(channel) > 0)
    ) {
      this.latestSnapshots.set(channel, payload);
    }

    if (!subscribers || !this.deliveryEnabled) return;
    for (const [rendererId, subscription] of subscribers) {
      if (subscription.target.isDestroyed()) {
        this.remove(channel, rendererId);
        continue;
      }
      if (!subscription.target.isVisible()) {
        this.setSubscriptionActive(channel, subscription, false);
        continue;
      }
      if (!subscription.active) continue;
      this.onPublish?.(rendererId, channel);
      this.increment(this.publicationCounts, rendererId, channel);
      this.queueDelivery(channel, subscription, payload);
    }
  }

  rendererBecameHidden(rendererId: number): void {
    for (const [channel, subscribers] of this.subscriptions) {
      const subscription = subscribers.get(rendererId);
      if (!subscription) continue;
      this.setSubscriptionActive(channel, subscription, false);
    }
  }

  rendererBecameVisible(rendererId: number): void {
    for (const [channel, subscribers] of this.subscriptions) {
      const subscription = subscribers.get(rendererId);
      if (!subscription) continue;
      if (subscription.target.isDestroyed()) {
        this.remove(channel, rendererId);
        continue;
      }
      if (!subscription.target.isVisible()) continue;

      const becameActive = this.setSubscriptionActive(
        channel,
        subscription,
        true
      );
      if (!becameActive) continue;
      if (subscription.lastDeliveredAt !== undefined) continue;

      const definition = this.definition(channel);
      if (
        this.deliveryEnabled &&
        definition.kind === 'snapshot' &&
        this.latestSnapshots.has(channel)
      ) {
        this.deliver(channel, subscription, this.latestSnapshots.get(channel));
      }
    }
  }

  subscriberCount(channel: string): number {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return 0;
    let count = 0;
    for (const subscription of subscribers.values()) {
      if (subscription.active) count += 1;
    }
    return count;
  }

  registeredSubscriberCount(channel: string): number {
    return this.subscriptions.get(channel)?.size ?? 0;
  }

  clearSnapshot(channel: string): void {
    const definition = this.definition(channel);
    if (definition.kind !== 'snapshot') {
      throw new Error(`Cannot clear event channel: ${channel}`);
    }
    this.latestSnapshots.delete(channel);
  }

  onSubscriberCountChanged(listener: SubscriberCountListener): () => void {
    this.subscriberCountListeners.add(listener);
    return () => this.subscriberCountListeners.delete(listener);
  }

  metricsSnapshot(): ChannelBusMetricsSnapshot {
    return {
      publications: Object.fromEntries(this.publicationCounts),
      deliveries: Object.fromEntries(this.deliveryCounts),
      channelPublications: Object.fromEntries(this.channelPublicationCounts),
      channelDeliveries: Object.fromEntries(this.channelDeliveryCounts),
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
        this.remove(channel, subscription.target.id);
        return;
      }
      if (!subscription.target.isVisible()) {
        this.setSubscriptionActive(channel, subscription, false);
        return;
      }
      if (!subscription.active) return;
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
    this.incrementChannel(this.channelDeliveryCounts, channel);
  }

  private increment(
    counters: Map<string, number>,
    rendererId: number,
    channel: string
  ): void {
    const key = `${rendererId}:${channel}`;
    counters.set(key, (counters.get(key) ?? 0) + 1);
  }

  private incrementChannel(
    counters: Map<string, number>,
    channel: string
  ): void {
    counters.set(channel, (counters.get(channel) ?? 0) + 1);
  }

  private remove(channel: string, rendererId: number): void {
    const subscribers = this.subscriptions.get(channel);
    const subscription = subscribers?.get(rendererId);
    subscription?.timer?.cancel();
    const removed = subscribers?.delete(rendererId) ?? false;
    if (subscribers?.size === 0) this.subscriptions.delete(channel);
    if (removed && subscription?.active) {
      if (this.subscriberCount(channel) === 0) {
        this.clearCachedSnapshot(channel);
      }
      this.notifySubscriberCount(channel);
    }
  }

  private setSubscriptionActive(
    channel: string,
    subscription: Subscription,
    active: boolean
  ): boolean {
    if (subscription.active === active) return false;
    subscription.active = active;
    subscription.timer?.cancel();
    subscription.timer = undefined;
    subscription.pending = undefined;
    subscription.lastDeliveredAt = undefined;
    if (!active && this.subscriberCount(channel) === 0) {
      this.clearCachedSnapshot(channel);
    }
    this.notifySubscriberCount(channel);
    return true;
  }

  private clearCachedSnapshot(channel: string): void {
    const definition = this.definition(channel);
    if (definition.kind === 'snapshot') {
      this.latestSnapshots.delete(channel);
    }
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
        const onHide = () => bus.rendererBecameHidden(event.sender.id);
        // `minimize`/`restore` are distinct from `hide`/`show`: Electron never
        // emits `show` when a window returns from the minimised state. Without
        // the `restore` listener a subscription deactivated by `publish()` — it
        // deactivates on `isVisible() === false` but never reactivates — would
        // stay dead for the life of the renderer.
        window?.on('show', onShow);
        window?.on('hide', onHide);
        window?.on('restore', onShow);
        window?.on('minimize', onHide);
        const cleanup = () => {
          window?.removeListener('show', onShow);
          window?.removeListener('hide', onHide);
          window?.removeListener('restore', onShow);
          window?.removeListener('minimize', onHide);
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
