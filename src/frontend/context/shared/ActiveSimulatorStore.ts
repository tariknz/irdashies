import type { ActiveSimulator, DashboardBridge } from '@irdashies/types';

type Listener = () => void;

export interface ActiveSimulatorStatus {
  simulator: ActiveSimulator | null;
  /**
   * True once the main process has answered, by the seeding request or a
   * change event, or when there is nothing to wait for. Until then a null
   * `simulator` means not known yet rather than none running.
   */
  loaded: boolean;
}

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
  private status: ActiveSimulatorStatus;
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
  private generation = 0;

  constructor(private readonly bridge: DashboardBridge) {
    // A bridge that cannot be asked has no answer coming.
    this.status = { simulator: null, loaded: !bridge.getActiveSimulator };
  }

  getSnapshot = (): ActiveSimulator | null => this.status.simulator;

  /** A new object only when the simulator or `loaded` changes. */
  getStatus = (): ActiveSimulatorStatus => this.status;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.open();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.close();
    };
  };

  private open(): void {
    const generation = ++this.generation;
    // Changes while closed went unseen: the cached simulator is kept, so
    // nothing flashes null, but it is no longer an answer until re-seeded.
    if (this.status.loaded && this.bridge.getActiveSimulator)
      this.status = { ...this.status, loaded: false };
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
    void this.bridge.getActiveSimulator?.().then(
      (value) => {
        if (generation === this.generation && !this.sawChange) this.set(value);
      },
      // No answer: what is known now is all there is.
      () => {
        if (generation === this.generation) this.set(this.status.simulator);
      }
    );
  }

  private close(): void {
    this.generation++;
    this.unsubscribeBridge?.();
    this.unsubscribeBridge = undefined;
  }

  /** Every value set is an answer, so it also marks the simulator loaded. */
  private set(value: ActiveSimulator | null): void {
    // useSyncExternalStore re-reads on every notification, so only a real
    // change is worth waking subscribers for.
    if (value === this.status.simulator && this.status.loaded) return;
    this.status = { simulator: value, loaded: true };
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
