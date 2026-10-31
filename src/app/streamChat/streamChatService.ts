import { randomUUID } from 'node:crypto';
import type {
  DashboardLayout,
  StreamChatMessage,
  StreamChatPlatform,
  StreamChatSourceStatus,
} from '@irdashies/types';
import {
  STREAM_CHAT_MAX_MESSAGES,
  normalizeStreamChatChannels,
  type StreamChatChannels,
} from '@irdashies/types';
import logger from '../logger';
import { createTwitchSource } from './twitchSource';
import { createYoutubeSource } from './youtubeSource';
import { loadChannelEmotes, loadGlobalEmotes } from './thirdPartyEmotes';
import type { EmoteMap } from './thirdPartyEmotes';
import type {
  RawStreamChatMessage,
  StreamChatSource,
  StreamChatSourceEvents,
} from './sources';

export interface StreamChatPublisher {
  publish: {
    (
      channel: 'streamchat.messages',
      payload: {
        messages: StreamChatMessage[];
        status: Record<StreamChatPlatform, StreamChatSourceStatus>;
      }
    ): void;
    (
      channel: 'streamchat.emotes',
      payload: { emotes: EmoteMap; channels: Record<string, EmoteMap> }
    ): void;
  };
}

export interface StreamChatSources {
  twitch: (
    events: StreamChatSourceEvents & {
      onRoomId: (roomId: string | undefined) => void;
    }
  ) => StreamChatSource;
  youtube: (events: StreamChatSourceEvents) => StreamChatSource;
}

export interface StreamChatServiceOptions {
  sources?: StreamChatSources;
  loadGlobalEmotes?: () => Promise<EmoteMap>;
  loadChannelEmotes?: (roomId: string) => Promise<EmoteMap>;
  now?: () => number;
}

const defaultSources: StreamChatSources = {
  twitch: (events) => createTwitchSource(events),
  youtube: (events) => createYoutubeSource(events),
};

/** What one dashboard asks for; nothing while its widget is disabled. */
export const readStreamChatChannels = (
  dashboard: DashboardLayout | undefined
): StreamChatChannels | undefined => {
  const widget = dashboard?.widgets.find((w) => w.id === 'streamchat');
  if (!widget?.enabled) return undefined;
  return normalizeStreamChatChannels(widget.config);
};

const STATUS_RANK: Record<StreamChatSourceStatus, number> = {
  off: 0,
  error: 1,
  waiting: 2,
  connecting: 3,
  connected: 4,
};

interface ChannelSource {
  platform: StreamChatPlatform;
  source: StreamChatSource;
  status: StreamChatSourceStatus;
}

const sourceKey = (platform: StreamChatPlatform, channel: string) =>
  `${platform}:${channel}`;

/**
 * Owns every outbound chat connection so neither the overlay nor an OBS
 * browser source has to reach the internet itself. It follows the channels of
 * every profile, not only the active one: a browser source pinned to another
 * profile with `?profile=` still gets its own chat. Each message carries its
 * channel and each widget keeps the ones its profile asks for. Messages from
 * all sources are merged in arrival order and published as one capped buffer.
 */
export class StreamChatService {
  private readonly sources: StreamChatSources;
  private readonly now: () => number;
  private readonly fetchGlobal: () => Promise<EmoteMap>;
  private readonly fetchChannel: (roomId: string) => Promise<EmoteMap>;
  private readonly active = new Map<string, ChannelSource>();
  private messages: StreamChatMessage[] = [];
  private globalEmotes: EmoteMap | undefined;
  private channelEmotes: Record<string, EmoteMap> = {};
  private roomIds = new Map<string, string>();
  private lastStatus: Record<StreamChatPlatform, StreamChatSourceStatus> = {
    twitch: 'off',
    youtube: 'off',
  };
  private disposed = false;

  constructor(
    private readonly bus: StreamChatPublisher,
    options: StreamChatServiceOptions = {}
  ) {
    this.sources = options.sources ?? defaultSources;
    this.now = options.now ?? Date.now;
    this.fetchGlobal = options.loadGlobalEmotes ?? (() => loadGlobalEmotes());
    this.fetchChannel =
      options.loadChannelEmotes ?? ((id) => loadChannelEmotes(id));
  }

  /**
   * Applies every profile's dashboard; connects the channels that are newly
   * wanted and disconnects the ones no profile asks for any more.
   */
  applyDashboards(dashboards: (DashboardLayout | undefined)[]): void {
    if (this.disposed) return;
    const wanted = new Map<string, [StreamChatPlatform, string]>();
    for (const dashboard of dashboards) {
      const channels = readStreamChatChannels(dashboard);
      if (!channels) continue;
      if (channels.twitch) {
        wanted.set(sourceKey('twitch', channels.twitch), [
          'twitch',
          channels.twitch,
        ]);
      }
      if (channels.youtube) {
        wanted.set(sourceKey('youtube', channels.youtube), [
          'youtube',
          channels.youtube,
        ]);
      }
    }

    let removed = false;
    for (const [key, entry] of [...this.active]) {
      if (wanted.has(key)) continue;
      this.active.delete(key);
      entry.source.dispose();
      const channel = key.slice(key.indexOf(':') + 1);
      this.messages = this.messages.filter(
        (m) => sourceKey(m.platform, m.channel) !== key
      );
      if (entry.platform === 'twitch') this.clearRoom(channel);
      removed = true;
    }
    for (const [key, [platform, channel]] of wanted) {
      if (!this.active.has(key)) this.connect(key, platform, channel);
    }
    if (removed) {
      this.publishMessages();
      this.publishEmotes();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.active.forEach((entry) => entry.source.dispose());
    this.active.clear();
    this.messages = [];
  }

  private connect(
    key: string,
    platform: StreamChatPlatform,
    channel: string
  ): void {
    const onMessage = (m: RawStreamChatMessage) =>
      this.addMessage(platform, channel, m);
    const onStatus = (s: StreamChatSourceStatus) => this.setStatus(key, s);
    const source =
      platform === 'twitch'
        ? this.sources.twitch({
            onMessage,
            onStatus,
            onRoomId: (id) => this.setRoomId(channel, id),
          })
        : this.sources.youtube({ onMessage, onStatus });
    this.active.set(key, { platform, source, status: 'off' });
    source.setChannel(channel);
    if (platform === 'twitch') void this.ensureGlobalEmotes();
  }

  private addMessage(
    platform: StreamChatPlatform,
    channel: string,
    raw: RawStreamChatMessage
  ): void {
    if (this.disposed || !this.active.has(sourceKey(platform, channel))) return;
    const message: StreamChatMessage = {
      ...raw,
      id: randomUUID(),
      platform,
      channel,
      timestamp: this.now(),
    };
    // Arrival order is the display order, so appending keeps it sorted.
    this.messages = [...this.messages, message].slice(
      -STREAM_CHAT_MAX_MESSAGES
    );
    this.publishMessages();
  }

  private setStatus(key: string, status: StreamChatSourceStatus): void {
    const entry = this.active.get(key);
    if (this.disposed || !entry || entry.status === status) return;
    entry.status = status;
    this.publishMessages();
  }

  /** Per platform, the best state any of its channels has reached. */
  private platformStatus(): Record<StreamChatPlatform, StreamChatSourceStatus> {
    const status: Record<StreamChatPlatform, StreamChatSourceStatus> = {
      twitch: 'off',
      youtube: 'off',
    };
    this.active.forEach((entry) => {
      if (STATUS_RANK[entry.status] > STATUS_RANK[status[entry.platform]]) {
        status[entry.platform] = entry.status;
      }
    });
    return status;
  }

  private publishMessages(): void {
    this.lastStatus = this.platformStatus();
    this.bus.publish('streamchat.messages', {
      messages: this.messages,
      status: this.lastStatus,
    });
  }

  private clearRoom(channel: string): void {
    this.roomIds.delete(channel);
    const { [channel]: removed, ...rest } = this.channelEmotes;
    void removed;
    this.channelEmotes = rest;
  }

  private setRoomId(channel: string, roomId: string | undefined): void {
    if (this.disposed || !this.active.has(sourceKey('twitch', channel))) return;
    if (roomId === this.roomIds.get(channel)) return;
    this.clearRoom(channel);
    if (!roomId) {
      this.publishEmotes();
      return;
    }
    this.roomIds.set(channel, roomId);
    this.fetchChannel(roomId)
      .then((emotes) => {
        if (this.disposed || this.roomIds.get(channel) !== roomId) return;
        this.channelEmotes = { ...this.channelEmotes, [channel]: emotes };
        this.publishEmotes();
      })
      .catch((error) =>
        logger.warn('[StreamChat] Channel emotes failed', error)
      );
  }

  private async ensureGlobalEmotes(): Promise<void> {
    if (this.globalEmotes) return;
    this.globalEmotes = {};
    try {
      this.globalEmotes = await this.fetchGlobal();
    } catch (error) {
      this.globalEmotes = undefined;
      logger.warn('[StreamChat] Global emotes failed', error);
      return;
    }
    if (!this.disposed) this.publishEmotes();
  }

  private publishEmotes(): void {
    this.bus.publish('streamchat.emotes', {
      emotes: { ...this.globalEmotes },
      channels: this.channelEmotes,
    });
  }
}
