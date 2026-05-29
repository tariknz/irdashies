import { describe, it, expect } from 'vitest';
import {
  mapLovelyToTrackData,
  slugify,
  type LovelyRawTrack,
} from './lovelyTrackData';
import bundle from '../../assets/data/tracks-bundle.json';

// Spec fixtures are sourced from the bundled tracks-bundle.json so the test
// data tracks the real Lovely schema — no per-file imports to maintain.
const tracks = (bundle as { tracks: Record<string, LovelyRawTrack> }).tracks;
const summit = tracks['spa up'];
const bathurst = tracks['nurburgring nordschleife'];
const brands = tracks['brandshatch grandprix'];

describe('slugify', () => {
  it('lowercases and snake-cases simple names', () => {
    expect(slugify('Eau Rouge')).toBe('eau_rouge');
  });

  it('strips diacritics', () => {
    expect(slugify('Brünnchen')).toBe('brunnchen');
    expect(slugify('Junção')).toBe('juncao');
  });

  it('handles punctuation and multiple spaces', () => {
    expect(slugify('Turn 1 - Senna S')).toBe('turn_1_senna_s');
  });

  it('falls back to "unnamed" for empty strings', () => {
    expect(slugify('')).toBe('unnamed');
    expect(slugify('---')).toBe('unnamed');
  });
});

describe('mapLovelyToTrackData', () => {
  it('maps Spa GP turns + straight + sectors', () => {
    const { sections, info } = mapLovelyToTrackData(
      summit as unknown as LovelyRawTrack
    );

    // 15 turns + 1 straight (Kemmel) = 16 sections
    expect(sections).toHaveLength(16);
    expect(info.name).toBe('Spa Grand Prix Pits - 2010');
    expect(info.country).toBe('BE');
    expect(info.length_m).toBe(6930);
    expect(info.pit_entry_pct).toBeCloseTo(0.971);
    expect(info.sectors).toHaveLength(5);
    expect(info.straights).toHaveLength(1);
    expect(info.straights[0].name).toBe('Kemmel Straight');
    expect(info.straights[0].type).toBe('straight');
  });

  it('sorts merged sections by start_pct', () => {
    const { sections } = mapLovelyToTrackData(
      summit as unknown as LovelyRawTrack
    );
    for (let i = 1; i < sections.length; i += 1) {
      expect(sections[i].start_pct).toBeGreaterThanOrEqual(
        sections[i - 1].start_pct
      );
    }
  });

  it('preserves per-turn marker when present (Nordschleife)', () => {
    const { sections } = mapLovelyToTrackData(
      bathurst as unknown as LovelyRawTrack
    );
    const hatzenbach = sections.find((s) => s.name === 'Hatzenbach');
    expect(hatzenbach).toBeDefined();
    expect(hatzenbach?.marker_pct).toBeCloseTo(0.045);
  });

  it('infers types from name regex', () => {
    const { sections } = mapLovelyToTrackData(
      bathurst as unknown as LovelyRawTrack
    );
    // Caracciola-Karussell → matches "karussell" rule → sweeper
    const karussell = sections.find((s) =>
      s.name.toLowerCase().includes('karussell')
    );
    expect(karussell?.type).toBe('sweeper');
  });

  it('extracts corner_number from "Turn N" names', () => {
    const fake: LovelyRawTrack = {
      name: 'Test',
      trackId: 'test',
      turn: [
        { start: 0, end: 0.1, name: 'Turn 1' },
        { start: 0.1, end: 0.2, name: 'Turn 12' },
        { start: 0.2, end: 0.3, name: 'Eau Rouge' },
      ],
    };
    const { sections } = mapLovelyToTrackData(fake);
    expect(sections[0].corner_number).toBe('T1');
    expect(sections[1].corner_number).toBe('T12');
    expect(sections[2].corner_number).toBeUndefined();
  });

  it('computes length_pct, including wrap-around at S/F', () => {
    const fake: LovelyRawTrack = {
      name: 'Test',
      trackId: 'test',
      turn: [
        { start: 0.1, end: 0.3, name: 'A' }, // 0.2
        { start: 0.95, end: 0.05, name: 'Wrap' }, // 0.10 wrap-aware
      ],
    };
    const { sections } = mapLovelyToTrackData(fake);
    const a = sections.find((s) => s.name === 'A');
    const w = sections.find((s) => s.name === 'Wrap');
    expect(a?.length_pct).toBeCloseTo(0.2);
    expect(w?.length_pct).toBeCloseTo(0.1);
  });

  it('names unnamed turns sequentially', () => {
    const fake: LovelyRawTrack = {
      name: 'Test',
      trackId: 'test',
      turn: [
        { start: 0, end: 0.1 },
        { start: 0.1, end: 0.2, name: 'Named' },
        { start: 0.2, end: 0.3 },
      ],
    };
    const { sections } = mapLovelyToTrackData(fake);
    const names = sections.map((s) => s.name).sort();
    expect(names).toContain('Turn 1');
    expect(names).toContain('Turn 2');
    expect(names).toContain('Named');
  });

  it('preserves track-level metadata (Brands GP)', () => {
    const { sections, info } = mapLovelyToTrackData(
      brands as unknown as LovelyRawTrack
    );
    expect(sections.length).toBeGreaterThan(0);
    expect(info.name).toBe('Brands Hatch GP');
    expect(info.country).toBe('UK');
    expect(info.length_m).toBeGreaterThan(0);
    expect(info.pit_entry_pct).toBeDefined();
    expect(info.pit_exit_pct).toBeDefined();
  });
});
