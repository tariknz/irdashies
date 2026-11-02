import { describe, it, expect } from 'vitest';
import { getDemoMessages } from './demoData';

const platforms = (messages: { platform: string }[]) =>
  new Set(messages.map((m) => m.platform));

describe('getDemoMessages', () => {
  it('returns only Twitch messages when only Twitch is set up', () => {
    const messages = getDemoMessages({ twitch: true, youtube: false });
    expect(messages.length).toBeGreaterThan(0);
    expect(platforms(messages)).toEqual(new Set(['twitch']));
  });

  it('returns only YouTube messages when only YouTube is set up', () => {
    const messages = getDemoMessages({ twitch: false, youtube: true });
    expect(messages.length).toBeGreaterThan(0);
    expect(platforms(messages)).toEqual(new Set(['youtube']));
  });

  it('mixes both platforms, with YouTube spread through the list', () => {
    const messages = getDemoMessages({ twitch: true, youtube: true });
    expect(platforms(messages)).toEqual(new Set(['twitch', 'youtube']));
    const firstYoutube = messages.findIndex((m) => m.platform === 'youtube');
    const lastYoutube = messages.map((m) => m.platform).lastIndexOf('youtube');
    expect(firstYoutube).toBeLessThan(5);
    expect(lastYoutube).toBeLessThan(messages.length - 1);
    expect(new Set(messages.map((m) => m.id)).size).toBe(messages.length);
  });

  it('returns nothing when no platform is set up', () => {
    expect(getDemoMessages({ twitch: false, youtube: false })).toEqual([]);
  });
});
