import { describe, expect, it, vi } from 'vitest';
import {
  RadarPoleSideOverrides,
  parsePoleSideOverrides,
  type PoleSideOverrides,
} from './radarPoleSideOverrides';

const store = (initial: unknown = undefined) => {
  let saved: unknown = initial;
  const write = vi.fn((overrides: PoleSideOverrides) => {
    saved = overrides;
  });
  const overrides = new RadarPoleSideOverrides({
    read: () => saved,
    write,
  });
  return { overrides, write, saved: () => saved };
};

describe('parsePoleSideOverrides', () => {
  it.each([null, undefined, 3, 'x', [true]])('gives nothing for %j', (raw) => {
    expect(parsePoleSideOverrides(raw)).toEqual({});
  });

  it('keeps canonical ids with a boolean and drops the rest', () => {
    expect(
      parsePoleSideOverrides({
        '95': true,
        '0': true,
        '012': true,
        abc: true,
        '7': 'left',
        '8': null,
        '444': false,
      })
    ).toEqual({ '95': true, '444': false });
  });
});

describe('RadarPoleSideOverrides', () => {
  it('has no override until one is flipped, or without a track id', () => {
    const { overrides } = store();
    expect(overrides.override(95)).toBeUndefined();
    expect(overrides.override(undefined)).toBeUndefined();
  });

  it('flips to the side opposite the table and remembers it', () => {
    const { overrides, write, saved } = store();
    overrides.setTrack(95, true);

    expect(overrides.flip()).toEqual({ trackId: 95, poleLeft: false });
    expect(overrides.override(95)).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
    expect(saved()).toEqual({ '95': false });
  });

  it('removes the entry when flipped back to what the table says', () => {
    const { overrides, saved } = store();
    overrides.setTrack(95, true);
    overrides.flip();

    expect(overrides.flip()).toEqual({ trackId: 95, poleLeft: true });
    expect(overrides.override(95)).toBeUndefined();
    expect(saved()).toEqual({});
  });

  it('starts from a saved override and keeps other tracks', () => {
    const { overrides, saved } = store({ '95': false, '212': true });
    overrides.setTrack(212, false);

    // The table says right (false), the player has left; flipping gives right.
    expect(overrides.flip()).toEqual({ trackId: 212, poleLeft: false });
    expect(saved()).toEqual({ '95': false });
  });

  it('does nothing before a track is known', () => {
    const { overrides, write } = store();
    expect(overrides.flip()).toBeUndefined();
    overrides.setTrack(undefined, true);
    overrides.setTrack(-3, true);
    expect(overrides.flip()).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
  });
});
