import type {
  ChannelBridge,
  ChannelName,
  ChannelPayloads,
} from '@irdashies/types';

type ChangeListener = () => void;

export class ChannelSnapshotStore<K extends ChannelName> {
  private snapshot: ChannelPayloads[K] | undefined;
  private readonly listeners = new Set<ChangeListener>();
  private unsubscribeBridge?: () => void;

  constructor(
    private readonly channel: K,
    private readonly rateHz?: number,
    private readonly bridge: ChannelBridge = window.channelBridge
  ) {}

  getSnapshot = (): ChannelPayloads[K] | undefined => this.snapshot;

  subscribe = (listener: ChangeListener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.unsubscribeBridge = this.bridge.subscribe(
        this.channel,
        (snapshot) => {
          this.snapshot = snapshot;
          for (const currentListener of this.listeners) currentListener();
        },
        this.rateHz
      );
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.unsubscribeBridge?.();
        this.unsubscribeBridge = undefined;
      }
    };
  };
}
