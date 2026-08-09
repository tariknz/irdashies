import {
  channelRegistry,
  type ChannelBridge,
  type ChannelName,
  type ChannelPayloads,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';

type ChangeListener = () => void;

export type ChannelSelector<K extends ChannelName, Selected> = (
  snapshot: ChannelPayloads[K]
) => Selected;

export type ChannelEquality<Selected> = (
  previous: Selected,
  next: Selected
) => boolean;

interface ChannelSelection<K extends ChannelName> {
  readonly rateHz?: number;
  evaluate(
    snapshot: ChannelPayloads[K],
    now: number,
    notify: boolean,
    recordCadence?: boolean
  ): void;
  refresh(now: number): void;
  isDue(now: number, defaultRateHz?: number, deliveryRateHz?: number): boolean;
  reset(): void;
}

interface ChannelSnapshotStoreOptions {
  now?: () => number;
  onError?: (error: unknown) => void;
}

export class ChannelSelectionStore<
  K extends ChannelName,
  Selected,
> implements ChannelSelection<K> {
  private selected: Selected | undefined;
  private hasSelection = false;
  private lastEvaluatedAt?: number;
  private lastEvaluatedSnapshot?: ChannelPayloads[K];
  private readonly listeners = new Set<ChangeListener>();
  private selector: ChannelSelector<K, Selected>;
  private equality: ChannelEquality<Selected>;

  constructor(
    private readonly parent: ChannelSnapshotStore<K>,
    selector: ChannelSelector<K, Selected>,
    equality: ChannelEquality<Selected>,
    readonly rateHz?: number,
    private readonly enabled = true
  ) {
    this.selector = selector;
    this.equality = equality;
  }

  getSnapshot = (): Selected | undefined => this.selected;

  subscribe = (listener: ChangeListener): (() => void) => {
    if (!this.enabled) return () => undefined;
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.parent.add(this);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.parent.remove(this);
    };
  };

  updateSelector(
    selector: ChannelSelector<K, Selected>,
    equality: ChannelEquality<Selected>
  ): void {
    if (this.selector === selector && this.equality === equality) return;
    this.selector = selector;
    this.equality = equality;
    this.parent.refresh(this);
  }

  evaluate(
    snapshot: ChannelPayloads[K],
    now: number,
    notify: boolean,
    recordCadence = true
  ): void {
    if (recordCadence) this.lastEvaluatedAt = now;
    this.lastEvaluatedSnapshot = snapshot;
    let next: Selected;
    try {
      next = this.selector(snapshot);
    } catch (error) {
      this.parent.report(error);
      return;
    }

    if (this.hasSelection) {
      try {
        if (this.equality(this.selected as Selected, next)) return;
      } catch (error) {
        this.parent.report(error);
        return;
      }
    }

    this.selected = next;
    this.hasSelection = true;
    if (!notify) return;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        this.parent.report(error);
      }
    }
  }

  refresh(now: number): void {
    if (this.lastEvaluatedSnapshot === undefined) return;
    this.evaluate(this.lastEvaluatedSnapshot, now, false, false);
  }

  isDue(now: number, defaultRateHz?: number, deliveryRateHz?: number): boolean {
    const effectiveRateHz = this.rateHz ?? defaultRateHz;
    // The bridge already enforces the aggregate (fastest) delivery rate.
    // Locally throttle only slower selections so the fastest selection is not
    // double-throttled and replayed snapshots are never dropped.
    if (
      effectiveRateHz === undefined ||
      deliveryRateHz === undefined ||
      effectiveRateHz >= deliveryRateHz ||
      this.lastEvaluatedAt === undefined
    ) {
      return true;
    }
    return now - this.lastEvaluatedAt >= 1000 / effectiveRateHz;
  }

  reset(): void {
    this.selected = undefined;
    this.hasSelection = false;
    this.lastEvaluatedAt = undefined;
    this.lastEvaluatedSnapshot = undefined;
  }
}

export class ChannelSnapshotStore<K extends ChannelName> {
  private snapshot: ChannelPayloads[K] | undefined;
  private readonly selections = new Set<ChannelSelection<K>>();
  private unsubscribeBridge?: () => void;
  private subscribedRateHz?: number;
  private readonly now: () => number;
  private readonly onError: (error: unknown) => void;

  constructor(
    private readonly channel: K,
    private readonly bridge: ChannelBridge,
    options: ChannelSnapshotStoreOptions = {}
  ) {
    this.now = options.now ?? (() => performance.now());
    this.onError =
      options.onError ??
      ((error) => logger.error(`Channel selector failed: ${channel}`, error));
  }

  createSelection<Selected>(
    selector: ChannelSelector<K, Selected>,
    equality: ChannelEquality<Selected> = Object.is,
    rateHz?: number,
    enabled = true
  ): ChannelSelectionStore<K, Selected> {
    return new ChannelSelectionStore(this, selector, equality, rateHz, enabled);
  }

  add(selection: ChannelSelection<K>): void {
    this.selections.add(selection);
    if (this.snapshot !== undefined) {
      selection.evaluate(this.snapshot, this.now(), false);
    }
    this.syncBridgeSubscription();
  }

  remove(selection: ChannelSelection<K>): void {
    if (!this.selections.delete(selection)) return;
    selection.reset();
    this.syncBridgeSubscription();
    if (this.selections.size === 0) this.snapshot = undefined;
  }

  refresh(selection: ChannelSelection<K>): void {
    if (!this.selections.has(selection)) return;
    selection.refresh(this.now());
  }

  report(error: unknown): void {
    try {
      this.onError(error);
    } catch {
      // Error reporting must not break delivery to other channel consumers.
    }
  }

  private receive = (snapshot: ChannelPayloads[K]): void => {
    if (this.selections.size === 0) return;
    this.snapshot = snapshot;
    const now = this.now();
    const definition = channelRegistry[this.channel];
    const defaultRateHz =
      definition.kind === 'snapshot' ? definition.defaultRateHz : undefined;
    for (const selection of this.selections) {
      if (!selection.isDue(now, defaultRateHz, this.subscribedRateHz)) continue;
      selection.evaluate(snapshot, now, true);
    }
  };

  private syncBridgeSubscription(): void {
    if (this.selections.size === 0) {
      this.unsubscribeBridge?.();
      this.unsubscribeBridge = undefined;
      this.subscribedRateHz = undefined;
      return;
    }

    const requestedRateHz = this.aggregateRateHz();
    if (this.unsubscribeBridge && this.subscribedRateHz === requestedRateHz) {
      return;
    }

    const previousUnsubscribe = this.unsubscribeBridge;
    const nextUnsubscribe = this.bridge.subscribe(
      this.channel,
      this.receive,
      requestedRateHz
    );
    this.unsubscribeBridge = nextUnsubscribe;
    this.subscribedRateHz = requestedRateHz;
    previousUnsubscribe?.();
  }

  private aggregateRateHz(): number | undefined {
    const definition = channelRegistry[this.channel];
    const defaultRateHz =
      definition.kind === 'snapshot' ? definition.defaultRateHz : undefined;
    let requestedRateHz: number | undefined;
    for (const selection of this.selections) {
      const currentRateHz = selection.rateHz ?? defaultRateHz;
      if (
        currentRateHz !== undefined &&
        (requestedRateHz === undefined || currentRateHz > requestedRateHz)
      ) {
        requestedRateHz = currentRateHz;
      }
    }
    return requestedRateHz;
  }
}

const storesByBridge = new WeakMap<ChannelBridge, Map<ChannelName, unknown>>();

export const getChannelSnapshotStore = <K extends ChannelName>(
  channel: K,
  bridge: ChannelBridge
): ChannelSnapshotStore<K> => {
  let stores = storesByBridge.get(bridge);
  if (!stores) {
    stores = new Map();
    storesByBridge.set(bridge, stores);
  }
  let store = stores.get(channel) as ChannelSnapshotStore<K> | undefined;
  if (!store) {
    store = new ChannelSnapshotStore(channel, bridge);
    stores.set(channel, store);
  }
  return store;
};
