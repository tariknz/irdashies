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

const setup = (
  overrides: {
    channelEmotes?: (id: string) => Promise<Record<string, string>>;
  } = {}
) => {
  const twitchEvents: { current?: TwitchEvents } = {};
  const youtubeEvents: { current?: StreamChatSourceEvents } = {};
  const twitch = { setChannel: vi.fn(), dispose: vi.fn() };
  const youtube = { setChannel: vi.fn(), dispose: vi.fn() };
  const sources: StreamChatSources = {
    twitch: (events) => {
      twitchEvents.current = events;
      return twitch;
    },
    youtube: (events) => {
      youtubeEvents.current = events;
      return youtube;
    },
  };
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
    twitch,
    youtube,
    twitchEvents,
    youtubeEvents,
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
  beforeEach(() => {
    ctx = setup();
  });

  it('connects the sources named by the dashboard', () => {
    ctx.service.applyDashboard(dashboard(both));
    expect(ctx.twitch.setChannel).toHaveBeenCalledWith('streamer');
    expect(ctx.youtube.setChannel).toHaveBeenCalledWith('@yt_chan');
  });

  it('leaves a source idle when its channel is empty', () => {
    ctx.service.applyDashboard(
      dashboard({ ...both, youtube: { channel: '' } })
    );
    expect(ctx.twitch.setChannel).toHaveBeenCalledWith('streamer');
    expect(ctx.youtube.setChannel).not.toHaveBeenCalled();
  });

  it('does not reconnect when unrelated settings change', () => {
    ctx.service.applyDashboard(dashboard(both));
    ctx.service.applyDashboard(
      dashboard({ ...both, display: { fontSize: 30 } })
    );
    expect(ctx.twitch.setChannel).toHaveBeenCalledTimes(1);
    expect(ctx.youtube.setChannel).toHaveBeenCalledTimes(1);
  });

  it('disconnects everything when the widget is disabled', () => {
    ctx.service.applyDashboard(dashboard(both));
    ctx.service.applyDashboard(dashboard(both, false));
    expect(ctx.twitch.setChannel).toHaveBeenLastCalledWith('');
    expect(ctx.youtube.setChannel).toHaveBeenLastCalledWith('');
  });

  it('merges both platforms in arrival order', () => {
    ctx.service.applyDashboard(dashboard(both));
    ctx.twitchEvents.current?.onMessage({ user: 'a', text: '1', emotes: [] });
    ctx.youtubeEvents.current?.onMessage({ user: 'b', text: '2', emotes: [] });
    ctx.twitchEvents.current?.onMessage({ user: 'c', text: '3', emotes: [] });

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
    ctx.service.applyDashboard(dashboard(both));
    for (let i = 0; i < STREAM_CHAT_MAX_MESSAGES + 5; i++) {
      ctx.twitchEvents.current?.onMessage({
        user: 'u',
        text: String(i),
        emotes: [],
      });
    }
    const { messages } = ctx.lastMessages();
    expect(messages).toHaveLength(STREAM_CHAT_MAX_MESSAGES);
    expect(messages.at(-1)?.text).toBe(String(STREAM_CHAT_MAX_MESSAGES + 4));
    expect(messages[0].text).toBe('5');
  });

  it("drops a platform's messages when its channel changes", () => {
    ctx.service.applyDashboard(dashboard(both));
    ctx.twitchEvents.current?.onMessage({ user: 'a', text: 't', emotes: [] });
    ctx.youtubeEvents.current?.onMessage({ user: 'b', text: 'y', emotes: [] });

    ctx.service.applyDashboard(
      dashboard({ ...both, twitch: { channel: 'other' } })
    );
    expect(ctx.lastMessages().messages.map((m) => m.platform)).toEqual([
      'youtube',
    ]);
  });

  it('publishes source status changes', () => {
    ctx.service.applyDashboard(dashboard(both));
    ctx.youtubeEvents.current?.onStatus('waiting');
    expect(ctx.lastMessages().status).toEqual({
      twitch: 'off',
      youtube: 'waiting',
    });
  });

  it('publishes global emotes once a Twitch channel is set', async () => {
    ctx.service.applyDashboard(dashboard(both));
    await vi.waitFor(() =>
      expect(ctx.publish).toHaveBeenCalledWith('streamchat.emotes', {
        emotes: { Kappa: 'g' },
      })
    );
    ctx.service.applyDashboard(
      dashboard({ ...both, twitch: { channel: 'other' } })
    );
    expect(ctx.loadGlobal).toHaveBeenCalledTimes(1);
  });

  it('adds channel emotes for the room id and clears them on disconnect', async () => {
    ctx.service.applyDashboard(dashboard(both));
    ctx.twitchEvents.current?.onRoomId('123');
    await vi.waitFor(() =>
      expect(ctx.publish).toHaveBeenCalledWith('streamchat.emotes', {
        emotes: { Kappa: 'g', Chan: 'c' },
      })
    );
    ctx.twitchEvents.current?.onRoomId(undefined);
    expect(ctx.publish).toHaveBeenLastCalledWith('streamchat.emotes', {
      emotes: { Kappa: 'g' },
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
    slow.service.applyDashboard(dashboard(both));
    slow.twitchEvents.current?.onRoomId('1');
    slow.twitchEvents.current?.onRoomId(undefined);
    resolve({ Late: 'x' });
    await Promise.resolve();
    await Promise.resolve();
    const emoteCalls = slow.publish.mock.calls.filter(
      ([channel]) => channel === 'streamchat.emotes'
    );
    expect(JSON.stringify(emoteCalls)).not.toContain('Late');
  });

  it('stops everything on dispose and ignores later input', () => {
    ctx.service.applyDashboard(dashboard(both));
    ctx.service.dispose();
    expect(ctx.twitch.dispose).toHaveBeenCalled();
    expect(ctx.youtube.dispose).toHaveBeenCalled();
    ctx.publish.mockClear();
    ctx.twitchEvents.current?.onMessage({ user: 'a', text: 'x', emotes: [] });
    ctx.service.applyDashboard(dashboard(both));
    expect(ctx.publish).not.toHaveBeenCalled();
  });
});
