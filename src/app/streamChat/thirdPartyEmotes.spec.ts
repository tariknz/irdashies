import { describe, it, expect, vi } from 'vitest';
import { loadChannelEmotes, loadGlobalEmotes } from './thirdPartyEmotes';

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('thirdPartyEmotes', () => {
  it('builds the global BTTV and 7TV maps like the old hook', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('betterttv')
        ? [{ id: 'b1', code: 'BttvEmote' }]
        : {
            emotes: [
              { name: 'SevenEmote', data: { host: { url: '//cdn/7' } } },
            ],
          }
    );
    expect(await loadGlobalEmotes(fetchJson)).toEqual({
      BttvEmote: 'https://cdn.betterttv.net/emote/b1/1x.webp',
      SevenEmote: 'https:' + '//cdn/7/1x.webp',
    });
  });

  it('combines channel and shared BTTV emotes with the 7TV set', async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes('betterttv')
        ? {
            channelEmotes: [{ id: '1', code: 'A' }],
            sharedEmotes: [{ id: '2', code: 'B' }],
          }
        : {
            emote_set: {
              emotes: [{ name: 'C', data: { host: { url: '//h/c' } } }],
            },
          }
    );
    const emotes = await loadChannelEmotes('123', fetchJson);
    expect(Object.keys(emotes).sort()).toEqual(['A', 'B', 'C']);
  });

  it('keeps what loaded when one provider fails', async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes('7tv')) throw new Error('down');
      return [{ id: 'b1', code: 'Only' }];
    });
    expect(Object.keys(await loadGlobalEmotes(fetchJson))).toEqual(['Only']);
  });

  it('ignores malformed payloads', async () => {
    const fetchJson = vi.fn(async () => ({ unexpected: true }));
    expect(await loadGlobalEmotes(fetchJson)).toEqual({});
    expect(await loadChannelEmotes('1', fetchJson)).toEqual({});
  });

  it('refuses a room id that is not numeric before building a URL', async () => {
    const fetchJson = vi.fn();
    expect(await loadChannelEmotes('../etc', fetchJson)).toEqual({});
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
