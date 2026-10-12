import { Innertube, Log } from 'youtubei.js';
import type {
  StreamChatBadge,
  StreamChatSegment,
  StreamChatSourceStatus,
} from '@irdashies/types';
import { YOUTUBE_HANDLE_PATTERN } from '@irdashies/types';
import logger from '../logger';
import type { StreamChatSource, StreamChatSourceEvents } from './sources';

/** How often to look for a live stream while the channel is not live. */
export const YOUTUBE_RETRY_INTERVAL_MS = 45_000;
const MAX_RETRY_INTERVAL_MS = 5 * 60_000;

/** Loose views of the YouTube.js objects: only what this file reads. */
interface YtThumbnail {
  url: string;
}
interface YtRun {
  text?: string;
  emoji?: { image?: YtThumbnail[]; shortcuts?: string[]; emoji_id?: string };
}
interface YtBadge {
  icon_type?: string;
  style?: string;
  tooltip?: string;
  label?: string;
  custom_thumbnail?: YtThumbnail[];
}
export interface YtChatItem {
  type?: string;
  id?: string;
  message?: { text?: string; runs?: YtRun[] };
  author?: {
    name?: string;
    badges?: YtBadge[];
    is_moderator?: boolean;
    is_creator?: boolean;
    is_verified?: boolean;
  };
}
export interface YtChatAction {
  type?: string;
  item?: YtChatItem;
}
export interface YtLiveChat {
  on: (event: string, listener: (...args: never[]) => void) => unknown;
  start: () => void;
  stop: () => void;
}
export interface YtVideoInfo {
  basic_info?: { is_live?: boolean };
  getLiveChat: () => YtLiveChat;
}
/**
 * The live tab lists plain videos (`video_id`, `is_live`) or the newer lockup
 * view (`content_id` only, liveness not exposed), so liveness is confirmed on
 * the video itself.
 */
export interface YtFeedVideo {
  video_id?: string;
  content_id?: string;
  content_type?: string;
  is_live?: boolean;
}
export interface YtChannelFeed {
  videos: ArrayLike<YtFeedVideo>;
}
export interface YtClient {
  resolveURL: (url: string) => Promise<{ payload?: { browseId?: string } }>;
  getChannel: (id: string) => Promise<{
    has_live_streams?: boolean;
    getLiveStreams: () => Promise<YtChannelFeed>;
  }>;
  getInfo: (videoId: string) => Promise<YtVideoInfo>;
}
export type YtClientFactory = () => Promise<YtClient>;

const defaultClientFactory: YtClientFactory = async () => {
  // YouTube.js prints a parser warning for every chat item type it does not
  // know yet; those are expected and say nothing about whether chat works.
  Log.setLevel(Log.Level.ERROR);
  return (await Innertube.create({
    retrieve_player: false,
    generate_session_locally: true,
  })) as unknown as YtClient;
};

/** Candidates checked per lookup; the live tab lists current streams first. */
const MAX_LIVE_CANDIDATES = 3;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const upgradeImageUrl = (url: string): string =>
  url.startsWith('//') ? `https:${url}` : url;

const toSegments = (
  message: NonNullable<YtChatItem['message']>
): StreamChatSegment[] => {
  const segments: StreamChatSegment[] = [];
  for (const run of message.runs ?? []) {
    const image = run.emoji?.image?.[0]?.url;
    if (image) {
      segments.push({
        type: 'emoji',
        url: upgradeImageUrl(image),
        alt: run.emoji?.shortcuts?.[0] ?? run.text ?? '',
      });
    } else if (run.text) {
      segments.push({ type: 'text', text: run.text });
    }
  }
  return segments;
};

const toBadges = (author: NonNullable<YtChatItem['author']>) => {
  const badges: StreamChatBadge[] = [];
  if (author.is_creator) badges.push({ kind: 'owner', label: 'Owner' });
  if (author.is_moderator)
    badges.push({ kind: 'moderator', label: 'Moderator' });
  if (author.is_verified) badges.push({ kind: 'verified', label: 'Verified' });
  for (const badge of author.badges ?? []) {
    const image = badge.custom_thumbnail?.[0]?.url;
    // Membership badges carry their own image; the role badges are covered
    // above from the author flags, so an image is what marks a member.
    if (image) {
      badges.push({
        kind: 'member',
        label: badge.tooltip ?? badge.label ?? 'Member',
        imageUrl: upgradeImageUrl(image),
      });
    }
  }
  return badges;
};

/**
 * Turns a YouTube.js chat action into a message, or undefined for everything
 * that is not an ordinary text message (banners, deletions, paid items...).
 */
export const parseYoutubeAction = (action: YtChatAction) => {
  const item = action.item;
  if (action.type !== 'AddChatItemAction' || !item) return undefined;
  if (item.type !== 'LiveChatTextMessage') return undefined;
  const user = item.author?.name;
  const text = item.message?.text;
  if (!user || !text) return undefined;
  const segments = toSegments(item.message ?? {});
  return {
    user,
    text,
    emotes: [],
    segments: segments.length ? segments : undefined,
    badges: item.author ? toBadges(item.author) : undefined,
  };
};

export const isValidYoutubeHandle = (handle: string): boolean =>
  YOUTUBE_HANDLE_PATTERN.test(handle);

/**
 * Reads the live chat of the channel's current stream. While the channel is
 * not live it keeps looking, backing off up to a few minutes, so chat appears
 * on its own once the stream starts.
 */
export const createYoutubeSource = (
  events: StreamChatSourceEvents,
  createClient: YtClientFactory = defaultClientFactory,
  retryIntervalMs: number = YOUTUBE_RETRY_INTERVAL_MS
): StreamChatSource => {
  let generation = 0;
  let current = '';
  let chat: YtLiveChat | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let client: Promise<YtClient> | undefined;

  const stopChat = () => {
    const stopping = chat;
    chat = undefined;
    if (!stopping) return;
    try {
      stopping.stop();
    } catch (error) {
      logger.warn('[StreamChat] YouTube chat stop failed', error);
    }
  };

  const reset = () => {
    generation += 1;
    if (timer) clearTimeout(timer);
    timer = undefined;
    stopChat();
  };

  const findLiveInfo = async (
    yt: YtClient,
    handle: string
  ): Promise<YtVideoInfo | undefined> => {
    const endpoint = await yt.resolveURL(`https://www.youtube.com/${handle}`);
    const browseId = endpoint.payload?.browseId;
    if (!browseId) throw new Error('Channel not found');
    const channel = await yt.getChannel(browseId);
    if (channel.has_live_streams === false) return undefined;
    const feed = await channel.getLiveStreams();
    const candidates = Array.from(feed.videos)
      .filter(
        (v) =>
          v.is_live !== false &&
          (v.content_type === undefined || v.content_type === 'VIDEO')
      )
      .map((v) => v.video_id ?? v.content_id)
      .filter((id): id is string => !!id && VIDEO_ID_PATTERN.test(id))
      .slice(0, MAX_LIVE_CANDIDATES);
    for (const id of candidates) {
      const info = await yt.getInfo(id);
      if (info.basic_info?.is_live) return info;
    }
    return undefined;
  };

  const attempt = async (handle: string, run: number, failures: number) => {
    const alive = () => run === generation;
    const retry = (status: StreamChatSourceStatus, nextFailures: number) => {
      if (!alive()) return;
      events.onStatus(status);
      const delay = Math.min(
        retryIntervalMs * 2 ** Math.min(nextFailures, 3),
        MAX_RETRY_INTERVAL_MS
      );
      timer = setTimeout(() => void attempt(handle, run, nextFailures), delay);
    };

    try {
      client ??= createClient();
      const yt = await client;
      const info = await findLiveInfo(yt, handle);
      if (!alive()) return;
      if (!info) return retry('waiting', 0);

      const liveChat = info.getLiveChat();
      chat = liveChat;

      liveChat.on('start', (() => {
        if (alive()) events.onStatus('connected');
      }) as never);
      liveChat.on('chat-update', ((action: YtChatAction) => {
        if (!alive()) return;
        const message = parseYoutubeAction(action);
        if (message) events.onMessage(message);
      }) as never);
      liveChat.on('error', ((error: unknown) => {
        if (!alive()) return;
        logger.warn('[StreamChat] YouTube chat error', String(error));
        stopChat();
        retry('error', failures + 1);
      }) as never);
      liveChat.on('end', (() => {
        if (!alive()) return;
        stopChat();
        retry('waiting', 0);
      }) as never);

      events.onStatus('connecting');
      liveChat.start();
    } catch (error) {
      if (!alive()) return;
      logger.warn(
        '[StreamChat] YouTube lookup failed',
        error instanceof Error ? error.message : String(error)
      );
      // A client that failed to build is not worth keeping.
      client = undefined;
      retry('error', failures + 1);
    }
  };

  return {
    setChannel: (channel: string) => {
      if (channel === current) return;
      reset();
      current = channel;
      if (!channel) {
        events.onStatus('off');
        return;
      }
      if (!isValidYoutubeHandle(channel)) {
        logger.warn('[StreamChat] Ignoring invalid YouTube handle');
        events.onStatus('error');
        return;
      }
      events.onStatus('connecting');
      void attempt(channel, generation, 0);
    },
    dispose: () => {
      reset();
      current = '';
      client = undefined;
    },
  };
};
