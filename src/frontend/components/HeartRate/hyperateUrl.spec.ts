import { describe, it, expect } from 'vitest';
import { buildHyperateEmbedUrl } from './hyperateUrl';

describe('buildHyperateEmbedUrl', () => {
  it('falls back to the default overlay when blank', () => {
    expect(buildHyperateEmbedUrl('KiY')).toBe('https://app.hyperate.io/KiY');
    expect(buildHyperateEmbedUrl('KiY', '   ')).toBe(
      'https://app.hyperate.io/KiY'
    );
  });

  it('treats a bare widget name as a hyperate.io route', () => {
    expect(buildHyperateEmbedUrl('KiY', 'Bouncing_Heart_Widget')).toBe(
      'https://hyperate.io/Bouncing_Heart_Widget?id=KiY'
    );
  });

  it('handles a bare name with a path/index.html', () => {
    expect(buildHyperateEmbedUrl('KiY', '007-Widget/index.html')).toBe(
      'https://hyperate.io/007-Widget/index.html?id=KiY'
    );
  });

  it('strips a leading slash on a bare name', () => {
    expect(buildHyperateEmbedUrl('KiY', '/Bouncing_Heart_Widget')).toBe(
      'https://hyperate.io/Bouncing_Heart_Widget?id=KiY'
    );
  });

  it('adds a scheme to a host without one', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'hyperate.io/Bouncing_Heart_Widget?id=x')
    ).toBe('https://hyperate.io/Bouncing_Heart_Widget?id=KiY');
    expect(
      buildHyperateEmbedUrl('KiY', 'www.hyperate.io/Bouncing_Heart_Widget')
    ).toBe('https://www.hyperate.io/Bouncing_Heart_Widget?id=KiY');
  });

  it('substitutes the YOUR-ID-HERE placeholder and fills the id param', () => {
    expect(
      buildHyperateEmbedUrl(
        'KiY',
        'https://hyperate.io/007-Widget/index.html?id=YOUR-ID-HERE'
      )
    ).toBe('https://hyperate.io/007-Widget/index.html?id=KiY');
  });

  it('replaces an existing id on a full URL', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://hyperate.io/Bouncing_Heart_Widget?id=old')
    ).toBe('https://hyperate.io/Bouncing_Heart_Widget?id=KiY');
  });

  it('adds the id param when a full URL has none', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://hyperate.io/Bouncing_Heart_Widget')
    ).toBe('https://hyperate.io/Bouncing_Heart_Widget?id=KiY');
  });

  it('overrides an existing id even when cased differently', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://hyperate.io/W?ID=someoneelse')
    ).toBe('https://hyperate.io/W?id=KiY');
  });

  it('collapses duplicate id params and preserves other params', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://hyperate.io/W?id=a&foo=bar&id=b')
    ).toBe('https://hyperate.io/W?foo=bar&id=KiY');
  });

  it('handles the app.hyperate.io animation route (id as path segment)', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://app.hyperate.io/animation/59/KiY')
    ).toBe('https://app.hyperate.io/animation/59/KiY');
  });

  it('overrides the session id in an animation route, keeping the animation id', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://app.hyperate.io/animation/59/someoneelse')
    ).toBe('https://app.hyperate.io/animation/59/KiY');
  });

  it('fills the placeholder in an animation route', () => {
    expect(
      buildHyperateEmbedUrl(
        'KiY',
        'app.hyperate.io/animation/59/YOUR-ID-HERE'
      )
    ).toBe('https://app.hyperate.io/animation/59/KiY');
  });

  it('replaces the path id on the default app.hyperate.io overlay', () => {
    expect(buildHyperateEmbedUrl('KiY', 'app.hyperate.io/oldid')).toBe(
      'https://app.hyperate.io/KiY'
    );
  });

  it('routes a bare "animation/<n>/<id>" to the app host', () => {
    expect(buildHyperateEmbedUrl('KiY', 'animation/59/old')).toBe(
      'https://app.hyperate.io/animation/59/KiY'
    );
  });

  it('ignores a stray id query param on the animation route', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://app.hyperate.io/animation/59/old?id=foo')
    ).toBe('https://app.hyperate.io/animation/59/KiY');
  });

  it('appends the session id to an animation route with no id (the default)', () => {
    expect(
      buildHyperateEmbedUrl('KiY', 'https://app.hyperate.io/animation/93')
    ).toBe('https://app.hyperate.io/animation/93/KiY');
  });

  it('falls back to the default overlay for non-HypeRate hosts', () => {
    expect(buildHyperateEmbedUrl('KiY', 'https://example.com/widget?id=1')).toBe(
      'https://app.hyperate.io/KiY'
    );
    expect(buildHyperateEmbedUrl('KiY', 'evil.com/Bouncing_Heart_Widget')).toBe(
      'https://app.hyperate.io/KiY'
    );
  });
});
