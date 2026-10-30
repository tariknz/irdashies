import { useMemo } from 'react';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useStreamChatMessagesSnapshot = (enabled = true) =>
  useChannelSnapshot('streamchat.messages', undefined, undefined, enabled);

/**
 * Third-party (BTTV/7TV) emotes keyed by emote code: the global set, plus the
 * channel sets of every followed Twitch channel keyed by login.
 */
export const useStreamChatEmotes = (
  enabled = true
): {
  global: Map<string, string>;
  channels: Map<string, Map<string, string>>;
} => {
  const snapshot = useChannelSnapshot(
    'streamchat.emotes',
    undefined,
    undefined,
    enabled
  );
  return useMemo(
    () => ({
      global: new Map(Object.entries(snapshot?.emotes ?? {})),
      channels: new Map(
        Object.entries(snapshot?.channels ?? {}).map(([channel, emotes]) => [
          channel,
          new Map(Object.entries(emotes)),
        ])
      ),
    }),
    [snapshot]
  );
};
