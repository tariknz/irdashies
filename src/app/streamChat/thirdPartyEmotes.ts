import logger from '../logger';

const BTTV_API = 'https://api.betterttv.net/3';
const BTTV_CDN = 'https://cdn.betterttv.net/emote';
const SEVENTV_API = 'https://7tv.io/v3';

export type EmoteMap = Record<string, string>;
export type FetchJson = (url: string) => Promise<unknown>;

const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const bttvEmotes = (list: unknown): EmoteMap => {
  const map: EmoteMap = {};
  if (!Array.isArray(list)) return map;
  for (const item of list) {
    if (
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.code === 'string'
    ) {
      map[item.code] = `${BTTV_CDN}/${item.id}/1x.webp`;
    }
  }
  return map;
};

const sevenTvEmotes = (list: unknown): EmoteMap => {
  const map: EmoteMap = {};
  if (!Array.isArray(list)) return map;
  for (const item of list) {
    if (!isRecord(item) || typeof item.name !== 'string') continue;
    const host = isRecord(item.data) ? item.data.host : undefined;
    if (isRecord(host) && typeof host.url === 'string') {
      map[item.name] = `https:${host.url}/1x.webp`;
    }
  }
  return map;
};

const safe = async (
  label: string,
  load: () => Promise<EmoteMap>
): Promise<EmoteMap> => {
  try {
    return await load();
  } catch (error) {
    logger.warn(`[StreamChat] Failed to load ${label} emotes`, error);
    return {};
  }
};

export const loadGlobalEmotes = async (
  fetchJson: FetchJson = defaultFetchJson
): Promise<EmoteMap> => {
  const [bttv, stv] = await Promise.all([
    safe('BTTV global', async () =>
      bttvEmotes(await fetchJson(`${BTTV_API}/cached/emotes/global`))
    ),
    safe('7TV global', async () => {
      const data = await fetchJson(`${SEVENTV_API}/emote-sets/global`);
      return sevenTvEmotes(isRecord(data) ? data.emotes : undefined);
    }),
  ]);
  return { ...bttv, ...stv };
};

export const loadChannelEmotes = async (
  roomId: string,
  fetchJson: FetchJson = defaultFetchJson
): Promise<EmoteMap> => {
  // The id comes from Twitch, but it ends up in a URL, so only digits pass.
  if (!/^\d{1,20}$/.test(roomId)) return {};
  const [bttv, stv] = await Promise.all([
    safe('BTTV channel', async () => {
      const data = await fetchJson(`${BTTV_API}/cached/users/twitch/${roomId}`);
      if (!isRecord(data)) return {};
      return {
        ...bttvEmotes(data.channelEmotes),
        ...bttvEmotes(data.sharedEmotes),
      };
    }),
    safe('7TV channel', async () => {
      const data = await fetchJson(`${SEVENTV_API}/users/twitch/${roomId}`);
      const set = isRecord(data) ? data.emote_set : undefined;
      return sevenTvEmotes(isRecord(set) ? set.emotes : undefined);
    }),
  ]);
  return { ...bttv, ...stv };
};
