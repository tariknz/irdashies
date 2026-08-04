export type SessionLifecycleEvent =
  | { type: 'enter'; replay: boolean }
  | { type: 'sessionNumChange' }
  | { type: 'disconnect' };

export interface ChannelPayloads {
  'session.lifecycle': SessionLifecycleEvent;
}

export type ChannelName = keyof ChannelPayloads;

export type ChannelDefinition =
  | {
      kind: 'snapshot';
      defaultRateHz: number;
      maxRateHz: number;
    }
  | {
      kind: 'event';
    };

export type ChannelRegistry = Readonly<Record<ChannelName, ChannelDefinition>>;

export const channelRegistry = {
  'session.lifecycle': { kind: 'event' },
} as const satisfies ChannelRegistry;

export interface ChannelBridge {
  subscribe<K extends ChannelName>(
    channel: K,
    callback: (payload: ChannelPayloads[K]) => void,
    requestedRateHz?: number
  ): () => void;
}
