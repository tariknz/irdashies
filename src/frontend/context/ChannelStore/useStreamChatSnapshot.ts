import { useMemo } from 'react';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useStreamChatMessagesSnapshot = (enabled = true) =>
  useChannelSnapshot('streamchat.messages', undefined, undefined, enabled);

/** Third-party (BTTV/7TV) emotes as a lookup keyed by emote code. */
export const useStreamChatEmotes = (enabled = true): Map<string, string> => {
  const snapshot = useChannelSnapshot(
    'streamchat.emotes',
    undefined,
    undefined,
    enabled
  );
  return useMemo(
    () => new Map(Object.entries(snapshot?.emotes ?? {})),
    [snapshot]
  );
};
