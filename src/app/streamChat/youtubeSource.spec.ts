import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createYoutubeSource,
  parseYoutubeAction,
  isValidYoutubeHandle,
  type YtChatAction,
  type YtClient,
  type YtLiveChat,
} from './youtubeSource';

vi.mock('youtubei.js', () => ({
  Innertube: { create: vi.fn() },
  Log: { setLevel: vi.fn(), Level: { ERROR: 1 } },
}));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const textAction = (overrides: Record<string, unknown> = {}): YtChatAction => ({
  type: 'AddChatItemAction',
  item: {
    type: 'LiveChatTextMessage',
    id: 'm1',
    message: { text: 'hello', runs: [{ text: 'hello' }] },
    author: { name: 'Viewer', badges: [] },
    ...overrides,
  },
});

describe('parseYoutubeAction', () => {
  it('parses a plain text message', () => {
    expect(parseYoutubeAction(textAction())).toEqual({
      user: 'Viewer',
      text: 'hello',
      emotes: [],
      segments: [{ type: 'text', text: 'hello' }],
      badges: [],
    });
  });

  it('keeps inline emoji as images in order', () => {
    const parsed = parseYoutubeAction(
      textAction({
        message: {
          text: 'go :fire:',
          runs: [
            { text: 'go ' },
            {
              text: ':fire:',
              emoji: {
                image: [{ url: '//yt3.ggpht.com/fire' }],
                shortcuts: [':fire:'],
              },
            },
          ],
        },
      })
    );
    expect(parsed?.segments).toEqual([
      { type: 'text', text: 'go ' },
      { type: 'emoji', url: 'https://yt3.ggpht.com/fire', alt: ':fire:' },
    ]);
  });

  it('maps author roles and member badges', () => {
    const parsed = parseYoutubeAction(
      textAction({
        author: {
          name: 'Boss',
          is_creator: true,
          is_moderator: true,
          is_verified: true,
          badges: [
            {
              tooltip: 'Member (2 years)',
              custom_thumbnail: [{ url: 'https://yt3.ggpht.com/badge' }],
            },
            { icon_type: 'MODERATOR' },
          ],
        },
      })
    );
    expect(parsed?.badges).toEqual([
      { kind: 'owner', label: 'Owner' },
      { kind: 'moderator', label: 'Moderator' },
      { kind: 'verified', label: 'Verified' },
      {
        kind: 'member',
        label: 'Member (2 years)',
        imageUrl: 'https://yt3.ggpht.com/badge',
      },
    ]);
  });

  it('ignores everything that is not a text message', () => {
    expect(parseYoutubeAction({ type: 'RemoveBannerForLiveChatCommand' })).toBe(
      undefined
    );
    expect(
      parseYoutubeAction(textAction({ type: 'LiveChatPaidMessage' }))
    ).toBe(undefined);
    expect(parseYoutubeAction(textAction({ message: { text: '' } }))).toBe(
      undefined
    );
    expect(parseYoutubeAction(textAction({ author: {} }))).toBe(undefined);
  });
});

describe('isValidYoutubeHandle', () => {
  it('requires a leading @ and a sane name', () => {
    expect(isValidYoutubeHandle('@channel')).toBe(true);
    expect(isValidYoutubeHandle('@a.b_c-d')).toBe(true);
    expect(isValidYoutubeHandle('channel')).toBe(false);
    expect(isValidYoutubeHandle('@ab')).toBe(false);
    expect(isValidYoutubeHandle('@../x')).toBe(false);
    expect(isValidYoutubeHandle('')).toBe(false);
  });
});

const fakeChat = () => {
  const listeners = new Map<string, (...args: never[]) => void>();
  const chat: YtLiveChat = {
    on: (event, listener) => {
      listeners.set(event, listener);
      return chat;
    },
    start: vi.fn(),
    stop: vi.fn(),
  };
  const emit = (event: string, payload?: unknown) =>
    (listeners.get(event) as ((p?: unknown) => void) | undefined)?.(payload);
  return { chat, emit };
};

const fakeClient = (
  liveVideoId: string | undefined,
  feed: {
    video_id?: string;
    content_id?: string;
    content_type?: string;
    is_live?: boolean;
  }[] = []
) => {
  const live = fakeChat();
  const client: YtClient = {
    resolveURL: vi.fn(async () => ({ payload: { browseId: 'UC123' } })),
    getChannel: vi.fn(async () => ({
      has_live_streams: true,
      getLiveStreams: async () => ({
        videos: feed.length
          ? feed
          : liveVideoId
            ? [
                { video_id: 'oldoldold11', is_live: false },
                { video_id: liveVideoId, is_live: true },
              ]
            : [{ video_id: 'oldoldold11', is_live: false }],
      }),
    })),
    getInfo: vi.fn(async (id: string) => ({
      basic_info: { is_live: id === liveVideoId },
      getLiveChat: () => live.chat,
    })),
  };
  return { client, live };
};

describe('createYoutubeSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (client: YtClient) => {
    const events = { onMessage: vi.fn(), onStatus: vi.fn() };
    const factory = vi.fn(async () => client);
    const source = createYoutubeSource(events, factory, 1000);
    return { source, events, factory };
  };

  it('connects to the live stream chat and forwards messages', async () => {
    const { client, live } = fakeClient('vid1vid1vid');
    const { source, events } = make(client);
    source.setChannel('@chan');
    await vi.advanceTimersByTimeAsync(0);

    expect(client.resolveURL).toHaveBeenCalledWith(
      'https://www.youtube.com/@chan'
    );
    expect(client.getInfo).toHaveBeenCalledWith('vid1vid1vid');
    expect(live.chat.start).toHaveBeenCalled();

    live.emit('start');
    expect(events.onStatus).toHaveBeenLastCalledWith('connected');
    live.emit('chat-update', textAction());
    expect(events.onMessage).toHaveBeenCalledTimes(1);
    live.emit('chat-update', { type: 'ShowLiveChatTooltipCommand' });
    expect(events.onMessage).toHaveBeenCalledTimes(1);
  });

  it('finds the live stream in the lockup-view feed by checking the video', async () => {
    const { client, live } = fakeClient('livelivelve', [
      { content_id: 'notlivenotl', content_type: 'VIDEO' },
      { content_id: 'livelivelve', content_type: 'VIDEO' },
      { content_id: 'PLAYLISTIDX', content_type: 'PLAYLIST' },
    ]);
    const { source } = make(client);
    source.setChannel('@chan');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(client.getInfo).toHaveBeenCalledWith('notlivenotl');
    expect(client.getInfo).toHaveBeenCalledWith('livelivelve');
    expect(client.getInfo).not.toHaveBeenCalledWith('PLAYLISTIDX');
    expect(live.chat.start).toHaveBeenCalled();
  });

  it('keeps looking while the channel is not live', async () => {
    const offline = fakeClient(undefined);
    const { source, events } = make(offline.client);
    source.setChannel('@chan');
    await vi.advanceTimersByTimeAsync(0);
    expect(events.onStatus).toHaveBeenLastCalledWith('waiting');
    expect(offline.client.getInfo).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(offline.client.resolveURL).toHaveBeenCalledTimes(2);
  });

  it('retries after a lookup failure, with growing delays', async () => {
    const { client } = fakeClient('vid1vid1vid');
    client.resolveURL = vi.fn(async () => {
      throw new Error('network');
    });
    const { source, events } = make(client);
    source.setChannel('@chan');
    await vi.advanceTimersByTimeAsync(0);
    expect(events.onStatus).toHaveBeenLastCalledWith('error');

    await vi.advanceTimersByTimeAsync(2000);
    expect(client.resolveURL).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.resolveURL).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.resolveURL).toHaveBeenCalledTimes(3);
  });

  it('goes back to waiting when the stream ends', async () => {
    const { client, live } = fakeClient('vid1vid1vid');
    const { source, events } = make(client);
    source.setChannel('@chan');
    await vi.advanceTimersByTimeAsync(0);
    live.emit('end');
    expect(live.chat.stop).toHaveBeenCalled();
    expect(events.onStatus).toHaveBeenLastCalledWith('waiting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.resolveURL).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid handle without touching the network', async () => {
    const { client } = fakeClient('vid1vid1vid');
    const { source, events, factory } = make(client);
    source.setChannel('not-a-handle');
    await vi.advanceTimersByTimeAsync(0);
    expect(factory).not.toHaveBeenCalled();
    expect(events.onStatus).toHaveBeenLastCalledWith('error');
  });

  it('stops the chat and pending retries when cleared or disposed', async () => {
    const { client, live } = fakeClient('vid1vid1vid');
    const { source, events } = make(client);
    source.setChannel('@chan');
    await vi.advanceTimersByTimeAsync(0);
    source.setChannel('');
    expect(live.chat.stop).toHaveBeenCalled();
    expect(events.onStatus).toHaveBeenLastCalledWith('off');

    live.emit('chat-update', textAction());
    expect(events.onMessage).not.toHaveBeenCalled();

    const offline = fakeClient(undefined);
    const second = make(offline.client);
    second.source.setChannel('@chan');
    await vi.advanceTimersByTimeAsync(0);
    second.source.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(offline.client.resolveURL).toHaveBeenCalledTimes(1);
  });
});
