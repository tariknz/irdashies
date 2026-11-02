import type {
  StreamChatMessage,
  StreamChatSourceStatus,
} from '@irdashies/types';

/** A message as a source produces it; the service stamps id and time. */
export type RawStreamChatMessage = Omit<
  StreamChatMessage,
  'id' | 'timestamp' | 'platform' | 'channel'
>;

export interface StreamChatSourceEvents {
  onMessage: (message: RawStreamChatMessage) => void;
  onStatus: (status: StreamChatSourceStatus) => void;
}

/** One chat provider. `setChannel('')` disconnects and leaves it idle. */
export interface StreamChatSource {
  setChannel: (channel: string) => void;
  dispose: () => void;
}
