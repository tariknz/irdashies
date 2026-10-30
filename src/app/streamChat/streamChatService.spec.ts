import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DashboardLayout, StreamChatMessage } from '@irdashies/types';
import { STREAM_CHAT_MAX_MESSAGES } from '@irdashies/types';
import {
  StreamChatService,
  readStreamChatChannels,
  type StreamChatSources,
} from './streamChatService';
import type { StreamChatSourceEvents } from './sources';

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type TwitchEvents = StreamChatSourceEvents & {
  onRoomId: (id: string | undefined) => void;
};

const dashboard = (
  config: unknown,
  enabled = true,
  id = 'streamchat'
): DashboardLayout =>
  ({
    widgets: [
      {
        id,
        enabled,
        layout: { x: 0, y: 0, width: 1, height: 1 },
        config,
      },
    ],
    generalSettings: {},
  }) as unknown as DashboardLayout;

interface FakeSource {
  setChannel: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

const setup = (
  overrides: {
    channelEmotes?: (id: string) => Promise<Record<string, string>>;
  } = {}
) => {
  // One source is created per channel, so tests look them up by channel.
  const twitchSources: { source: FakeSource; events: TwitchEvents }[] = [];
  const youtubeSources: {
    source: FakeSource;
    events: StreamChatSourceEvents;
  }[] = [];
  const sources: StreamChatSources = {
    twitch: (events) => {
      const source = { setChannel: vi.fn(), dispose: vi.fn() };
      twitchSources.push({ source, events });
      return source;
    },
    youtube: (events) => {
      const source = { setChannel: vi.fn(), dispose: vi.fn() };
      youtubeSources.push({ source, events });
      return source;
    },
  };
  const named = <T extends { source: FakeSource }>(
    list: T[],
    channel: string
  ) => list.find((s) => s.source.setChannel.mock.calls[0]?.[0] === channel);
  const publish = vi.fn();
  let clock = 1000;
  const loadGlobal = vi.fn().mockResolvedValue({ Kappa: 'g' });
  const service = new StreamChatService({ publish } as never, {
    sources,
    now: () => clock++,
    loadGlobalEmotes: loadGlobal,
    loadChannelEmotes:
      overrides.channelEmotes ?? vi.fn().mockResolvedValue({ Chan: 'c' }),
  });
  const lastMessages = () => {
    const calls = publish.mock.calls.filter(
      ([channel]) => channel === 'streamchat.messages'
    );
    return calls.at(-1)?.[1] as {
      messages: StreamChatMessage[];
      status: Record<string, string>;
    };
  };
  return {
    service,
    publish,
    twitchSources,
    youtubeSources,
    twitch: (channel = 'streamer') => {
      const found = named(twitchSources, channel);
      if (!found) throw new Error(`No Twitch source for ${channel}`);
      return found;
    },
    youtube: (channel = '@yt_chan') => {
      const found = named(youtubeSources, channel);
      if (!found) throw new Error(`No YouTube source for ${channel}`);
      return found;
    },
    lastMessages,
    loadGlobal,
  };
};

const both = {
  twitch: { channel: 'Streamer' },
  youtube: { channel: '@yt_chan' },
};

describe('readStreamChatChannels', () => {
  it('returns nothing while the widget is disabled or missing', () => {
    expect(readStreamChatChannels(dashboard(both, false))).toBeUndefined();
    expect(readStreamChatChannels(undefined)).toBeUndefined();
    expect(readStreamChatChannels(dashboard(both, true, 'other'))).toBe(
      undefined
    );
  });

  it('lowercases the Twitch channel and keeps the YouTube handle', () => {
    expect(readStreamChatChannels(dashboard(both))).toEqual({
      twitch: 'streamer',
      youtube: '@yt_chan',
    });
  });

  it('treats malformed channels as empty', () => {
    expect(
      readStreamChatChannels(
        dashboard({
          twitch: { channel: 'bad name!' },
          youtube: { channel: 'no-at-sign' },
        })
      )
    ).toEqual({ twitch: '', youtube: '' });
    expect(
      readStreamChatChannels(dashboard({ twitch: 5, youtube: null }))
    ).toEqual({ twitch: '', youtube: '' });
  });
});

describe('StreamChatService', () => {
  let ctx: ReturnType<typeof setup>;
  const msg = (text: string) => ({ user: 'a', text, emotes: [] });
  beforeEach(() => {
    ctx = setup();
  });

  it('connects the sources named by the dashboard', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    expect(ctx.twitch().source.setChannel).toHaveBeenCalledWith('streamer');
    expect(ctx.youtube().source.setChannel).toHaveBeenCalledWith('@yt_chan');
  });

  it('leaves a source idle when its channel is empty', () => {
    ctx.service.applyDashboards([
      dashboard({ ...both, youtube: { channel: '' } }),
    ]);
    expect(ctx.twitchSources).toHaveLength(1);
    expect(ctx.youtubeSources).toHaveLength(0);
  });

  it('does not reconnect when unrelated settings change', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    ctx.service.applyDashboards([
      dashboard({ ...both, display: { fontSize: 30 } }),
    ]);
    expect(ctx.twitchSources).toHaveLength(1);
    expect(ctx.youtubeSources).toHaveLength(1);
    expect(ctx.twitch().source.dispose).not.toHaveBeenCalled();
  });

  it('disconnects everything when the widget is disabled', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    const twitch = ctx.twitch();
    const youtube = ctx.youtube();
    ctx.service.applyDashboards([dashboard(both, false)]);
    expect(twitch.source.dispose).toHaveBeenCalled();
    expect(youtube.source.dispose).toHaveBeenCalled();
  });

  it('follows the channels of every profile, not just one', () => {
    const other = { twitch: { channel: 'Pinned' }, youtube: { channel: '' } };
    ctx.service.applyDashboards([dashboard(both), dashboard(other)]);
    expect(ctx.twitch('streamer')).toBeDefined();
    expect(ctx.twitch('pinned')).toBeDefined();
    expect(ctx.youtubeSources).toHaveLength(1);
  });

  it('shares one connection between profiles with the same channel', () => {
    ctx.service.applyDashboards([dashboard(both), dashboard(both)]);
    expect(ctx.twitchSources).toHaveLength(1);
    expect(ctx.youtubeSources).toHaveLength(1);
  });

  it('keeps a channel connected while another profile still wants it', () => {
    ctx.service.applyDashboards([dashboard(both), dashboard(both)]);
    ctx.service.applyDashboards([dashboard(both)]);
    expect(ctx.twitch().source.dispose).not.toHaveBeenCalled();
  });

  it('tags each message with its channel', () => {
    const other = { twitch: { channel: 'pinned' }, youtube: { channel: '' } };
    ctx.service.applyDashboards([dashboard(both), dashboard(other)]);
    ctx.twitch('streamer').events.onMessage(msg('1'));
    ctx.twitch('pinned').events.onMessage(msg('2'));
    ctx.youtube().events.onMessage(msg('3'));
    expect(
      ctx.lastMessages().messages.map((m) => [m.platform, m.channel, m.text])
    ).toEqual([
      ['twitch', 'streamer', '1'],
      ['twitch', 'pinned', '2'],
      ['youtube', '@yt_chan', '3'],
    ]);
  });

  it('merges both platforms in arrival order', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    ctx.twitch().events.onMessage(msg('1'));
    ctx.youtube().events.onMessage(msg('2'));
    ctx.twitch().events.onMessage(msg('3'));

    const { messages } = ctx.lastMessages();
    expect(messages.map((m) => [m.platform, m.text])).toEqual([
      ['twitch', '1'],
      ['youtube', '2'],
      ['twitch', '3'],
    ]);
    const stamps = messages.map((m) => m.timestamp);
    expect([...stamps].sort((x, y) => x - y)).toEqual(stamps);
    expect(new Set(messages.map((m) => m.id)).size).toBe(3);
  });

  it('keeps only the newest messages', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    for (let i = 0; i < STREAM_CHAT_MAX_MESSAGES + 5; i++) {
      ctx.twitch().events.onMessage(msg(String(i)));
    }
    const { messages } = ctx.lastMessages();
    expect(messages).toHaveLength(STREAM_CHAT_MAX_MESSAGES);
    expect(messages.at(-1)?.text).toBe(String(STREAM_CHAT_MAX_MESSAGES + 4));
    expect(messages[0].text).toBe('5');
  });

  it("drops a channel's messages when no profile follows it any more", () => {
    ctx.service.applyDashboards([dashboard(both)]);
    ctx.twitch().events.onMessage(msg('t'));
    ctx.youtube().events.onMessage(msg('y'));

    ctx.service.applyDashboards([
      dashboard({ ...both, twitch: { channel: 'other' } }),
    ]);
    expect(ctx.lastMessages().messages.map((m) => m.platform)).toEqual([
      'youtube',
    ]);
  });

  it('ignores messages from a source that was disconnected', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    const old = ctx.twitch();
    ctx.service.applyDashboards([
      dashboard({ ...both, twitch: { channel: 'other' } }),
    ]);
    old.events.onMessage(msg('late'));
    expect(ctx.lastMessages().messages).toEqual([]);
  });

  it('publishes source status changes, best state per platform', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    ctx.youtube().events.onStatus('waiting');
    expect(ctx.lastMessages().status).toEqual({
      twitch: 'off',
      youtube: 'waiting',
    });
  });

  it('publishes global emotes once a Twitch channel is set', async () => {
    ctx.service.applyDashboards([dashboard(both)]);
    await vi.waitFor(() =>
      expect(ctx.publish).toHaveBeenCalledWith('streamchat.emotes', {
        emotes: { Kappa: 'g' },
        channels: {},
      })
    );
    ctx.service.applyDashboards([
      dashboard({ ...both, twitch: { channel: 'other' } }),
    ]);
    expect(ctx.loadGlobal).toHaveBeenCalledTimes(1);
  });

  it('keeps channel emotes per channel and clears them on disconnect', async () => {
    ctx.service.applyDashboards([dashboard(both)]);
    ctx.twitch().events.onRoomId('123');
    await vi.waitFor(() =>
      expect(ctx.publish).toHaveBeenCalledWith('streamchat.emotes', {
        emotes: { Kappa: 'g' },
        channels: { streamer: { Chan: 'c' } },
      })
    );
    ctx.twitch().events.onRoomId(undefined);
    expect(ctx.publish).toHaveBeenLastCalledWith('streamchat.emotes', {
      emotes: { Kappa: 'g' },
      channels: {},
    });
  });

  it('ignores channel emotes that arrive after the room changed', async () => {
    let resolve: (emotes: Record<string, string>) => void = () => undefined;
    const slow = setup({
      channelEmotes: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    slow.service.applyDashboards([dashboard(both)]);
    slow.twitch().events.onRoomId('1');
    slow.twitch().events.onRoomId(undefined);
    resolve({ Late: 'x' });
    await Promise.resolve();
    await Promise.resolve();
    const emoteCalls = slow.publish.mock.calls.filter(
      ([channel]) => channel === 'streamchat.emotes'
    );
    expect(JSON.stringify(emoteCalls)).not.toContain('Late');
  });

  it('stops everything on dispose and ignores later input', () => {
    ctx.service.applyDashboards([dashboard(both)]);
    const twitch = ctx.twitch();
    const youtube = ctx.youtube();
    ctx.service.dispose();
    expect(twitch.source.dispose).toHaveBeenCalled();
    expect(youtube.source.dispose).toHaveBeenCalled();
    ctx.publish.mockClear();
    twitch.events.onMessage(msg('x'));
    ctx.service.applyDashboards([dashboard(both)]);
    expect(ctx.publish).not.toHaveBeenCalled();
  });
});
