export type StreamChatPlatform = 'twitch' | 'youtube';

/** Position of a Twitch emote in `StreamChatMessage.text`, as sent by IRC. */
export interface StreamChatEmote {
  id: string;
  indices: [number, number][];
}

export type StreamChatBadgeKind =
  'owner' | 'moderator' | 'member' | 'verified' | 'other';

export interface StreamChatBadge {
  kind: StreamChatBadgeKind;
  label: string;
  /** Custom badge image (YouTube member badges); other kinds use an icon. */
  imageUrl?: string;
}

/** A piece of a message that is either plain text or an inline emoji image. */
export type StreamChatSegment =
  { type: 'text'; text: string } | { type: 'emoji'; url: string; alt: string };

export interface StreamChatMessage {
  id: string;
  platform: StreamChatPlatform;
  /**
   * The channel it came from: the lowercased Twitch login or the YouTube
   * `@handle`. The service follows the channels of every profile, so a widget
   * keeps only the messages of its own profile's channels.
   */
  channel: string;
  /** Epoch ms the message was received by the app; the display order. */
  timestamp: number;
  user: string;
  color?: string;
  text: string;
  /** Twitch emotes, indexed into `text`. */
  emotes: StreamChatEmote[];
  /** YouTube messages: text and emoji in order. Absent for Twitch. */
  segments?: StreamChatSegment[];
  badges?: StreamChatBadge[];
}

export type StreamChatSourceStatus =
  'off' | 'connecting' | 'connected' | 'waiting' | 'error';

export interface StreamChatMessagesSnapshot {
  /** Oldest first, capped at STREAM_CHAT_MAX_MESSAGES. */
  messages: StreamChatMessage[];
  status: Record<StreamChatPlatform, StreamChatSourceStatus>;
}

export interface StreamChatEmotesSnapshot {
  /** Global third-party (BTTV/7TV) emote code to image URL. */
  emotes: Record<string, string>;
  /** Emotes of one Twitch channel's own sets, keyed by lowercased login. */
  channels: Record<string, Record<string, string>>;
}

export const STREAM_CHAT_MAX_MESSAGES = 100;

/**
 * `@handle` as YouTube shows it; the leading `@` is required. Handles are
 * localized, so any Unicode letter, mark or digit is allowed (3-30 characters
 * counted as code points) next to `.`, `_` and `-`. Separators such as `/`
 * stay out, so a handle cannot alter the lookup URL.
 */
export const YOUTUBE_HANDLE_PATTERN = /^@[\p{L}\p{M}\p{N}._-]{3,30}$/u;

/** Twitch login names: 4-25 characters, letters, digits and underscore. */
export const TWITCH_CHANNEL_PATTERN = /^[A-Za-z0-9_]{1,25}$/;

export interface StreamChatChannels {
  twitch: string;
  youtube: string;
}

const cleanChannel = (value: unknown, pattern: RegExp): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return pattern.test(trimmed) ? trimmed : '';
};

/**
 * The channels a widget config asks for. Persisted settings are untrusted, so
 * a channel that does not look like a channel name counts as empty. Shared by
 * the service and the widget so both agree on what a channel is called.
 */
export const normalizeStreamChatChannels = (
  config: unknown
): StreamChatChannels => {
  const c = config as
    | { twitch?: { channel?: unknown }; youtube?: { channel?: unknown } }
    | undefined;
  return {
    twitch: cleanChannel(
      c?.twitch?.channel,
      TWITCH_CHANNEL_PATTERN
    ).toLowerCase(),
    youtube: cleanChannel(c?.youtube?.channel, YOUTUBE_HANDLE_PATTERN),
  };
};
