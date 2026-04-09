import { useEffect, useState } from 'react';

// Configure your Twitch application Client ID at dev.twitch.tv
// CLIENT_ID registered by Chlaston (Mira Chlastak)  -> ready for OATH
const TWITCH_CLIENT_ID = '55sor7qpeoe4ptyin4jfkr22pm9yqt';

interface TwitchApiEmote {
  id: string;
  name: string;
}

interface TwitchApiEmotesResponse {
  data: TwitchApiEmote[];
}

/**
 * Fetches globally available Twitch emotes via the Helix API using only
 * a Client-ID (no OAuth). Returns a map of emote id -> emote name.
 *
 * Note: The Helix endpoint requires a Bearer token in production. If the
 * request fails (e.g. missing auth), emotes from IRC message tags are still
 * rendered via the public CDN — this map is used only for name lookup.
 *
 */
export function useTwitchEmotes(): Map<string, string> {
  const [emoteMap, setEmoteMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch('https://api.twitch.tv/helix/chat/emotes/global', {
      headers: { 'Client-Id': TWITCH_CLIENT_ID },
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<TwitchApiEmotesResponse>;
      })
      .then((data) => {
        if (!data) return;
        const map = new Map<string, string>();
        for (const emote of data.data) {
          map.set(emote.id, emote.name);
        }
        setEmoteMap(map);
      })
      .catch(() => {
        // Silently ignore — emote images load directly from Twitch CDN
      });
  }, []);

  return emoteMap;
}

export function getTwitchEmoteUrl(emoteId: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`;
}
