import { useEffect, useState } from 'react';

export type ThirdPartyEmoteMap = Map<string, string>;

const BTTV_API = 'https://api.betterttv.net/3';
const BTTV_CDN = 'https://cdn.betterttv.net/emote';
const SEVENTV_API = 'https://7tv.io/v3';

interface BttvEmote {
  id: string;
  code: string;
}

interface SevenTvEmote {
  name: string;
  data: { host: { url: string } };
}

async function fetchBttvGlobal(): Promise<ThirdPartyEmoteMap> {
  try {
    const res = await fetch(`${BTTV_API}/cached/emotes/global`);
    if (!res.ok) return new Map();
    const data: BttvEmote[] = await res.json();
    return new Map(data.map((e) => [e.code, `${BTTV_CDN}/${e.id}/1x.webp`]));
  } catch {
    return new Map();
  }
}

async function fetchBttvChannel(roomId: string): Promise<ThirdPartyEmoteMap> {
  try {
    const res = await fetch(`${BTTV_API}/cached/users/twitch/${roomId}`);
    if (!res.ok) return new Map();
    const data: { channelEmotes: BttvEmote[]; sharedEmotes: BttvEmote[] } =
      await res.json();
    const emotes = [
      ...(data.channelEmotes ?? []),
      ...(data.sharedEmotes ?? []),
    ];
    return new Map(
      emotes.map((e) => [e.code, `${BTTV_CDN}/${e.id}/1x.webp`])
    );
  } catch {
    return new Map();
  }
}

async function fetchSevenTvGlobal(): Promise<ThirdPartyEmoteMap> {
  try {
    const res = await fetch(`${SEVENTV_API}/emote-sets/global`);
    if (!res.ok) return new Map();
    const data: { emotes: SevenTvEmote[] } = await res.json();
    return new Map(
      data.emotes.map((e) => [e.name, `https:${e.data.host.url}/1x.webp`])
    );
  } catch {
    return new Map();
  }
}

async function fetchSevenTvChannel(roomId: string): Promise<ThirdPartyEmoteMap> {
  try {
    const res = await fetch(`${SEVENTV_API}/users/twitch/${roomId}`);
    if (!res.ok) return new Map();
    const data: { emote_set: { emotes: SevenTvEmote[] } } = await res.json();
    return new Map(
      (data.emote_set?.emotes ?? []).map((e) => [
        e.name,
        `https:${e.data.host.url}/1x.webp`,
      ])
    );
  } catch {
    return new Map();
  }
}

export function useThirdPartyEmotes(
  roomId: string | undefined
): ThirdPartyEmoteMap {
  const [emoteMap, setEmoteMap] = useState<ThirdPartyEmoteMap>(new Map());

  useEffect(() => {
    const load = async () => {
      const [bttv, stv] = await Promise.all([
        fetchBttvGlobal(),
        fetchSevenTvGlobal(),
      ]);
      setEmoteMap(new Map([...bttv, ...stv]));
    };
    void load();
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      const [bttv, stv] = await Promise.all([
        fetchBttvChannel(roomId),
        fetchSevenTvChannel(roomId),
      ]);
      setEmoteMap((prev) => new Map([...prev, ...bttv, ...stv]));
    };
    void load();
  }, [roomId]);

  return emoteMap;
}
