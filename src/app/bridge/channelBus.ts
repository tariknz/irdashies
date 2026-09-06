import type {
  ChannelDefinition,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';
import { channelRegistry } from '@irdashies/types';

export const CHANNEL_SUBSCRIBE = 'channels:subscribe';
export const CHANNEL_UNSUBSCRIBE = 'channels:unsubscribe';
export const CHANNEL_DELIVERY = 'channels:delivery';

/**
 * Structural view of a subscriber the bus can deliver to. Electron supplies a
 * `WebContents`-backed implementation; other hosts (the marketing site's
 * in-browser preview) supply their own. Deliberately free of Electron types so
 * this module stays importable outside the main process.
 */
export interface RendererTarget {
  readonly id: number;
  isDestroyed(): boolean;
  isVisible(): boolean;
  send(channel: string, name: string, payload: unknown): void;
}

export interface TimerHandle {
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

/**
 * `activeCount` is visible demand. `registeredCount` also includes hidden
 * windows that are still subscribed.
 */
type SubscriberCountListener = (
  channel: string,
  activeCount: number,
  registeredCount: number
) => void;

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

/**
 * Whether a channel stops delivering while its window is hidden.
 *
 * Only snapshot channels do. A hidden window has nothing to draw, and it is
 * re-seeded from `latestSnapshots` when it comes back, so nothing is lost.
 *
 * Event channels are never gated. Each publish is a discrete fact — an
 * incident, a session change — that no later snapshot can reconstruct, so
 * suppressing one while the window is hidden loses it permanently. A minimised
 * Gantry used to miss every incident of a race that way. All event channels are
 * low volume, so delivering to a hidden window costs nothing worth saving.
 */
const isVisibilityGated = (definition: ChannelDefinition): boolean =>
  definition.kind === 'snapshot';

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
      const active = isVisibilityGated(definition) ? target.isVisible() : true;
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
    const active = isVisibilityGated(definition) ? target.isVisible() : true;
    const subscription: Subscription = { target, rateHz, active };
    const hadCachedSnapshotBeforeSubscribe =
      definition.kind === 'snapshot' && this.latestSnapshots.has(channel);
    const cachedSnapshotBeforeSubscribe = this.latestSnapshots.get(channel);
    subscribers.set(target.id, subscription);
    if (
      !active &&
      definition.kind === 'snapshot' &&
      this.subscriberCount(channel) === 0
    ) {
      this.latestSnapshots.delete(channel);
    }
    // A hidden subscription still changes the registered count.
    this.notifySubscriberCount(channel);

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
      if (isVisibilityGated(definition)) {
        if (!subscription.target.isVisible()) {
          this.setSubscriptionActive(channel, subscription, false);
          continue;
        }
        if (!subscription.active) continue;
      }
      this.onPublish?.(rendererId, channel);
      this.increment(this.publicationCounts, rendererId, channel);
      this.queueDelivery(channel, subscription, payload);
    }
  }

  rendererBecameHidden(rendererId: number): void {
    for (const [channel, subscribers] of this.subscriptions) {
      const subscription = subscribers.get(rendererId);
      if (!subscription) continue;
      // Event subscriptions stay active while the window is away, so a
      // minimised window keeps receiving them instead of losing them.
      if (!isVisibilityGated(this.definition(channel))) continue;
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
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Invalid channel rate: ${String(rate)}`);
    }
    // Renderer rates are desired ceilings. Enforce the authoritative channel
    // limit here so an overly broad widget preset cannot make subscription
    // startup fail or increase main-process delivery work.
    return Math.min(rate, definition.maxRateHz);
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
    if (!removed) return;
    if (subscription?.active && this.subscriberCount(channel) === 0) {
      this.clearCachedSnapshot(channel);
    }
    this.notifySubscriberCount(channel);
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
    const activeCount = this.subscriberCount(channel);
    const registeredCount = this.registeredSubscriberCount(channel);
    this.subscriberCountListeners.forEach((listener) =>
      listener(channel, activeCount, registeredCount)
    );
  }
}
