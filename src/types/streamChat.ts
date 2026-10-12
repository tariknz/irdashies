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
  /** Third-party (BTTV/7TV) emote code to image URL. */
  emotes: Record<string, string>;
}

export const STREAM_CHAT_MAX_MESSAGES = 100;

/** `@handle` as YouTube shows it; the leading `@` is required. */
export const YOUTUBE_HANDLE_PATTERN = /^@[A-Za-z0-9._-]{3,30}$/;

/** Twitch login names: 4-25 characters, letters, digits and underscore. */
export const TWITCH_CHANNEL_PATTERN = /^[A-Za-z0-9_]{1,25}$/;
