import { Client } from '@tmi.js/chat';
import type { RoomState } from '@tmi.js/chat';
import type { StreamChatEmote } from '@irdashies/types';
import logger from '../logger';
import type { StreamChatSource, StreamChatSourceEvents } from './sources';

interface TwitchMessageEvent {
  user: { display?: string; login?: string; color?: string };
  message: { text?: string; emotes?: StreamChatEmote[] };
}

/** The subset of the tmi.js client the source relies on. */
export interface TwitchClient {
  connect: () => void;
  close: () => void;
  on: (event: string, listener: (...args: never[]) => void) => unknown;
}

export type TwitchClientFactory = (channel: string) => TwitchClient;

const defaultClientFactory: TwitchClientFactory = (channel) =>
  new Client({ channels: [channel] }) as unknown as TwitchClient;

/**
 * Anonymous Twitch IRC reader. Behaviour matches the renderer hook it
 * replaces: every message with a user name and text is forwarded, and the
 * room id is reported so BTTV/7TV channel emotes can be looked up.
 */
export const createTwitchSource = (
  events: StreamChatSourceEvents & {
    onRoomId: (roomId: string | undefined) => void;
  },
  createClient: TwitchClientFactory = defaultClientFactory
): StreamChatSource => {
  let client: TwitchClient | undefined;
  let current = '';

  const close = () => {
    const closing = client;
    client = undefined;
    if (!closing) return;
    try {
      closing.close();
    } catch (error) {
      logger.warn('[StreamChat] Twitch client close failed', error);
    }
    events.onRoomId(undefined);
  };

  const setChannel = (channel: string) => {
    if (channel === current) return;
    close();
    current = channel;
    if (!channel) {
      events.onStatus('off');
      return;
    }

    events.onStatus('connecting');
    const next = createClient(channel);
    client = next;

    next.on('connect', () => {
      if (client === next) events.onStatus('connected');
    });
    next.on('roomState', ((event: RoomState.Event) => {
      if (client === next && event.tags.roomId) {
        events.onRoomId(event.tags.roomId);
      }
    }) as never);
    next.on('error', ((error: Error) => {
      if (client !== next) return;
      logger.warn('[StreamChat] Twitch error', error.message);
      events.onStatus('error');
    }) as never);
    next.on('message', ((msg: unknown) => {
      if (client !== next) return;
      const event = msg as TwitchMessageEvent;
      const user = event.user?.display || event.user?.login;
      const text = event.message?.text;
      if (!user || !text) return;
      events.onMessage({
        user,
        color: event.user.color || undefined,
        text,
        emotes: event.message.emotes ?? [],
      });
    }) as never);

    try {
      next.connect();
    } catch (error) {
      logger.warn('[StreamChat] Twitch connect failed', error);
      events.onStatus('error');
    }
  };

  return {
    setChannel,
    dispose: () => {
      close();
      current = '';
    },
  };
};
