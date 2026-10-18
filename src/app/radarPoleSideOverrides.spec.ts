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

  it('keeps canonical ids with a table side and a correction', () => {
    expect(
      parsePoleSideOverrides({
        '95': { start: false, table: true },
        '212': { restart: true, table: false },
        '0': { start: true, table: true },
        '012': { start: true, table: true },
        abc: { start: true, table: true },
        '7': { start: 'left', table: true },
        '8': { table: true },
        '9': { start: true },
        '10': null,
      })
    ).toEqual({
      '95': { start: false, table: true },
      '212': { restart: true, table: false },
    });
  });
});

describe('RadarPoleSideOverrides', () => {
  it('has no override until one is flipped, or without a track id', () => {
    const { overrides } = store();
    expect(overrides.override(95, 'start')).toBeUndefined();
    expect(overrides.override(undefined, 'start')).toBeUndefined();
  });

  it('flips to the side opposite the table, for the situation, and remembers it', () => {
    const { overrides, write, saved } = store();
    overrides.setTrack(95, true, 'start');

    expect(overrides.flip()).toEqual({
      trackId: 95,
      situation: 'start',
      poleLeft: false,
    });
    expect(overrides.override(95, 'start')).toBe(false);
    expect(overrides.override(95, 'restart')).toBeUndefined();
    expect(write).toHaveBeenCalledTimes(1);
    expect(saved()).toEqual({ '95': { start: false, table: true } });
  });

  it('keeps a start and a restart correction apart', () => {
    const { overrides, saved } = store();
    overrides.setTrack(95, true, 'start');
    overrides.flip();
    overrides.setTrack(95, true, 'restart');
    overrides.flip();

    expect(saved()).toEqual({
      '95': { start: false, restart: false, table: true },
    });

    // Back to the table for the restart only.
    overrides.flip();
    expect(saved()).toEqual({ '95': { start: false, table: true } });
  });

  it('removes the entry when flipped back to what the table says', () => {
    const { overrides, saved } = store();
    overrides.setTrack(95, true, 'start');
    overrides.flip();

    expect(overrides.flip()).toEqual({
      trackId: 95,
      situation: 'start',
      poleLeft: true,
    });
    expect(overrides.override(95, 'start')).toBeUndefined();
    expect(saved()).toEqual({});
  });

  it('starts from a saved correction and keeps other tracks', () => {
    const { overrides, saved } = store({
      '95': { start: false, table: true },
      '212': { start: true, table: false },
    });
    overrides.setTrack(212, false, 'start');

    // The table says right, the player has left; flipping gives right again.
    expect(overrides.flip()).toEqual({
      trackId: 212,
      situation: 'start',
      poleLeft: false,
    });
    expect(saved()).toEqual({ '95': { start: false, table: true } });
  });

  it('gives a copy of the corrections for the report', () => {
    const { overrides } = store({ '95': { start: false, table: true } });
    const copy = overrides.snapshot();
    copy['95'].start = true;
    expect(overrides.override(95, 'start')).toBe(false);
  });

  it('tells listeners once per saved flip, until they stop listening', () => {
    const { overrides } = store();
    const listener = vi.fn();
    const stop = overrides.onChange(listener);
    overrides.setTrack(95, true, 'start');

    overrides.flip();
    overrides.flip();
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    overrides.flip();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does nothing before a track is known', () => {
    const { overrides, write } = store();
    expect(overrides.flip()).toBeUndefined();
    overrides.setTrack(undefined, true, 'start');
    overrides.setTrack(-3, true, 'start');
    expect(overrides.flip()).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
  });
});
