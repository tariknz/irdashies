import { randomUUID } from 'node:crypto';
import type {
  DashboardLayout,
  StreamChatMessage,
  StreamChatPlatform,
  StreamChatSourceStatus,
} from '@irdashies/types';
import {
  STREAM_CHAT_MAX_MESSAGES,
  TWITCH_CHANNEL_PATTERN,
  YOUTUBE_HANDLE_PATTERN,
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
    (channel: 'streamchat.emotes', payload: { emotes: EmoteMap }): void;
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

export interface StreamChatChannels {
  twitch: string;
  youtube: string;
}

const defaultSources: StreamChatSources = {
  twitch: (events) => createTwitchSource(events),
  youtube: (events) => createYoutubeSource(events),
};

const clean = (value: unknown, pattern: RegExp): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return pattern.test(trimmed) ? trimmed : '';
};

/**
 * What the dashboard asks for. Persisted settings are untrusted, so a channel
 * that does not look like a channel name counts as empty.
 */
export const readStreamChatChannels = (
  dashboard: DashboardLayout | undefined
): StreamChatChannels | undefined => {
  const widget = dashboard?.widgets.find((w) => w.id === 'streamchat');
  if (!widget?.enabled) return undefined;
  const config = widget.config as
    | {
        twitch?: { channel?: unknown };
        youtube?: { channel?: unknown };
      }
    | undefined;
  return {
    twitch: clean(
      config?.twitch?.channel,
      TWITCH_CHANNEL_PATTERN
    ).toLowerCase(),
    youtube: clean(config?.youtube?.channel, YOUTUBE_HANDLE_PATTERN),
  };
};

/**
 * Owns every outbound chat connection so neither the overlay nor an OBS
 * browser source has to reach the internet itself. Messages from all sources
 * are merged in arrival order and published as one capped buffer.
 */
export class StreamChatService {
  private readonly twitch: StreamChatSource;
  private readonly youtube: StreamChatSource;
  private readonly now: () => number;
  private readonly fetchGlobal: () => Promise<EmoteMap>;
  private readonly fetchChannel: (roomId: string) => Promise<EmoteMap>;
  private messages: StreamChatMessage[] = [];
  private status: Record<StreamChatPlatform, StreamChatSourceStatus> = {
    twitch: 'off',
    youtube: 'off',
  };
  private globalEmotes: EmoteMap | undefined;
  private channelEmotes: EmoteMap = {};
  private roomId: string | undefined;
  private channels: StreamChatChannels = { twitch: '', youtube: '' };
  private disposed = false;

  constructor(
    private readonly bus: StreamChatPublisher,
    options: StreamChatServiceOptions = {}
  ) {
    const sources = options.sources ?? defaultSources;
    this.now = options.now ?? Date.now;
    this.fetchGlobal = options.loadGlobalEmotes ?? (() => loadGlobalEmotes());
    this.fetchChannel =
      options.loadChannelEmotes ?? ((id) => loadChannelEmotes(id));
    this.twitch = sources.twitch({
      onMessage: (m) => this.addMessage('twitch', m),
      onStatus: (s) => this.setStatus('twitch', s),
      onRoomId: (id) => this.setRoomId(id),
    });
    this.youtube = sources.youtube({
      onMessage: (m) => this.addMessage('youtube', m),
      onStatus: (s) => this.setStatus('youtube', s),
    });
  }

  /** Applies the dashboard; connects, reconnects or disconnects as needed. */
  applyDashboard(dashboard: DashboardLayout | undefined): void {
    if (this.disposed) return;
    const wanted = readStreamChatChannels(dashboard) ?? {
      twitch: '',
      youtube: '',
    };
    const twitchChanged = wanted.twitch !== this.channels.twitch;
    const youtubeChanged = wanted.youtube !== this.channels.youtube;
    this.channels = wanted;

    if (twitchChanged) {
      this.dropMessages('twitch');
      this.twitch.setChannel(wanted.twitch);
      if (wanted.twitch) void this.ensureGlobalEmotes();
    }
    if (youtubeChanged) {
      this.dropMessages('youtube');
      this.youtube.setChannel(wanted.youtube);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.twitch.dispose();
    this.youtube.dispose();
    this.messages = [];
  }

  private addMessage(
    platform: StreamChatPlatform,
    raw: RawStreamChatMessage
  ): void {
    if (this.disposed) return;
    const message: StreamChatMessage = {
      ...raw,
      id: randomUUID(),
      platform,
      timestamp: this.now(),
    };
    // Arrival order is the display order, so appending keeps it sorted.
    this.messages = [...this.messages, message].slice(
      -STREAM_CHAT_MAX_MESSAGES
    );
    this.publishMessages();
  }

  private dropMessages(platform: StreamChatPlatform): void {
    const kept = this.messages.filter((m) => m.platform !== platform);
    if (kept.length === this.messages.length) return;
    this.messages = kept;
    this.publishMessages();
  }

  private setStatus(
    platform: StreamChatPlatform,
    status: StreamChatSourceStatus
  ): void {
    if (this.disposed || this.status[platform] === status) return;
    this.status = { ...this.status, [platform]: status };
    this.publishMessages();
  }

  private publishMessages(): void {
    this.bus.publish('streamchat.messages', {
      messages: this.messages,
      status: this.status,
    });
  }

  private setRoomId(roomId: string | undefined): void {
    if (this.disposed || roomId === this.roomId) return;
    this.roomId = roomId;
    this.channelEmotes = {};
    if (!roomId) {
      this.publishEmotes();
      return;
    }
    this.fetchChannel(roomId)
      .then((emotes) => {
        if (this.disposed || this.roomId !== roomId) return;
        this.channelEmotes = emotes;
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
      emotes: { ...this.globalEmotes, ...this.channelEmotes },
    });
  }
}
