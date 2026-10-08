import type { ActiveSimulator, DashboardBridge } from '@irdashies/types';

type Listener = () => void;

/**
 * One bridge subscription for the running simulator, shared by every caller.
 *
 * The hook over this used to open its own `onSimulatorChanged` listener and
 * its own seeding request per component. That is fine for a settings panel
 * and wrong inside a table row: the standings render one row per driver, so
 * a full grid meant dozens of IPC listeners registered and torn down on every
 * remount. Callers then had to know to resolve the simulator once per widget
 * and thread it down as a prop, which is a constraint that cannot be enforced
 * and was easy to get wrong.
 *
 * Mirrors ChannelSnapshotStore: listeners are ref-counted, the bridge
 * subscription opens on the first and closes with the last.
 */
export class ActiveSimulatorStore {
  private simulator: ActiveSimulator | null = null;
  private readonly listeners = new Set<Listener>();
  private unsubscribeBridge?: () => void;
  /**
   * True once a change event has arrived. The seeding request answers for the
   * moment it was made, so once something newer has landed the snapshot is
   * stale and must not overwrite it -- a simulator change while the request is
   * in flight would otherwise leave the header and the widget filtering naming
   * the previous sim until the next event.
   */
  private sawChange = false;

  constructor(private readonly bridge: DashboardBridge) {}

  getSnapshot = (): ActiveSimulator | null => this.simulator;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.open();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.close();
    };
  };

  private open(): void {
    // Subscribed before the request is made, so a change that lands while it
    // is in flight is seen rather than missed.
    this.sawChange = false;
    this.unsubscribeBridge = this.bridge.onSimulatorChanged?.((value) => {
      this.sawChange = true;
      this.set(value);
    });

    // Re-seeded on every reopen, not just the first: with no listeners there
    // was no subscription, so any change in that window was missed and the
    // cached value may be stale.
    void this.bridge.getActiveSimulator?.().then((value) => {
      if (!this.sawChange) this.set(value);
    });
  }

  private close(): void {
    this.unsubscribeBridge?.();
    this.unsubscribeBridge = undefined;
  }

  private set(value: ActiveSimulator | null): void {
    // useSyncExternalStore re-reads on every notification, so only a real
    // change is worth waking subscribers for.
    if (value === this.simulator) return;
    this.simulator = value;
    for (const listener of this.listeners) listener();
  }
}

/** Weak so a store dies with the bridge it belongs to, as with channels. */
const storesByBridge = new WeakMap<DashboardBridge, ActiveSimulatorStore>();

export const getActiveSimulatorStore = (
  bridge: DashboardBridge
): ActiveSimulatorStore => {
  let store = storesByBridge.get(bridge);
  if (!store) {
    store = new ActiveSimulatorStore(bridge);
    storesByBridge.set(bridge, store);
  }
  return store;
};
