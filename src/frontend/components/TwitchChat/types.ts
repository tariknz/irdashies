export interface ChatMessage {
  user: string;
  text: string;
  id: string;
}

export interface TwitchUser {
  id: string;
  color: string;
  display: string;
  badges: Record<string, string>;
  badgeInfo: Record<string, string>;
  isBot: boolean;
  isBroadcaster: boolean;
  isMod: boolean;
  isLeadMod: boolean;
  isSubscriber: boolean;
  isFounder: boolean;
  isVip: boolean;
  type: string;
  login: string;
  isTurbo: boolean;
  isReturningChatter: boolean;
}

export interface TwitchChannel {
  lastUserstate: null | Record<string, unknown>;
  _id: string;
  _login: string;
}

export interface TwitchMessageBody {
  id: string;
  text: string;
  flags: unknown[];
  emotes: unknown[];
  isAction: boolean;
  isFirst: boolean;
}

export interface TwitchMessageEvent {
  channel: TwitchChannel;
  user: TwitchUser;
  message: TwitchMessageBody;
  sharedChat?: unknown;
  announcement?: unknown;
  cheer?: unknown;
  parent?: unknown;
  reward?: unknown;
  tags: Record<string, unknown>;
}
