import { describe, expect, it } from 'vitest';
import { lmuTrackDataId } from '@irdashies/types';
import {
  getAvailableLmuTracks,
  loadLmuTrackData,
  loadTrackData,
} from './trackData';
import { mapLovelyToTrackData } from './lovelyTrackData';

/**
 * Covers the name matching, which is the part that can be confidently wrong.
 *
 * The bundle is keyed by iRacing's lowercase slugs, and the near-miss fallback
 * exists for the small drift between two spellings of the same circuit. It had
 * no way to answer "no match", so a name from another sim came back as a real
 * track on the strength of one shared generic word -- and the corner widgets
 * showed that circuit's corners.
 */
describe('loadTrackData', () => {
  it('matches an iRacing track name exactly', () => {
    expect(loadTrackData('nurburgring nordschleife')?.trackId).toBe(
      'nurburgring nordschleife'
    );
    expect(loadTrackData('lagunaseca')?.trackId).toBe('lagunaseca');
    expect(loadTrackData('spa combined')?.trackId).toBe('spa combined');
  });

  it('still bridges the drift it was written for', () => {
    // iRacing says "silverstone gp", the dataset says "silverstone 2019 gp".
    expect(loadTrackData('silverstone gp')?.trackId).toBe(
      'silverstone 2019 gp'
    );
  });

  it('refuses a match that rests on a generic word alone', () => {
    // "WeatherTech Raceway Laguna Seca" used to resolve to "summit summit
    // raceway", because both contain "raceway". An LMU track name shares no
    // distinctive word with any entry, so the honest answer is none.
    expect(loadTrackData('WeatherTech Raceway Laguna Seca')).toBeNull();
    expect(loadTrackData('Bahrain International Circuit')).toBeNull();
    expect(loadTrackData('Lusail International Circuit')).toBeNull();
  });

  it('never guesses at a name from another sim', () => {
    // The dataset's scheme is lowercase throughout, and every iRacing
    // TrackName is. A Title Case display name belongs to another sim, and
    // guessing at those is what produced wrong circuits -- "Michelin Raceway
    // Road Atlanta" matched "daytona 2011 road" on the word "road".
    expect(loadTrackData('Michelin Raceway Road Atlanta')).toBeNull();
    expect(loadTrackData('Sebring International Raceway')).toBeNull();
    // Such names come through LMU_TRACK_DATA_IDS instead.
    const alias = lmuTrackDataId('Michelin Raceway Road Atlanta');
    expect(alias).toBe('roadatlanta full');
    expect(loadTrackData(alias ?? '')?.trackId).toBe('roadatlanta full');
  });

  it('still matches a lowercase near miss', () => {
    // The guard is about which scheme the name is in, not about rejecting
    // near misses within the dataset's own.
    expect(loadTrackData('sebring international raceway')?.trackId).toBe(
      'sebring international'
    );
  });

  it('returns null for nothing usable', () => {
    expect(loadTrackData('')).toBeNull();
    expect(loadTrackData('   ')).toBeNull();
    expect(loadTrackData('International Circuit')).toBeNull();
  });
});

describe('an LMU track name, end to end', () => {
  /** Exactly what the shared hook does. */
  const sectionsFor = (trackName: string) => {
    const raw = loadTrackData(lmuTrackDataId(trackName) ?? trackName);
    return raw ? mapLovelyToTrackData(raw).sections : [];
  };

  it('gives Laguna Seca its own corners, with the dataset ranges', () => {
    const sections = sectionsFor('WeatherTech Raceway Laguna Seca');
    const byName = (name: string) => sections.find((s) => s.name === name);

    // Ten corners and the Rahal Straight: the mapper merges named straights
    // in too, which is what lets the overlay label a long piece of track.
    expect(sections).toHaveLength(11);
    expect(byName('Rahal Straight')?.type).toBe('straight');
    // The ranges are the dataset's, not a window derived around a point.
    expect(byName('Turn 1')?.start_pct).toBe(0.045);
    expect(byName('Turn 1')?.end_pct).toBe(0.08);
    expect(byName('The Corkscrew')?.start_pct).toBe(0.661);
    expect(byName('The Corkscrew')?.end_pct).toBe(0.72);
    expect(byName('Andretti Hairpin')).toBeDefined();
    // Numbered corners keep their number; named ones do not claim one.
    expect(byName('Turn 9')?.corner_number).toBe('T9');
    expect(byName('The Corkscrew')?.corner_number).toBeUndefined();
  });

  it('gives Spa its corners in lap order', () => {
    const sections = sectionsFor('Circuit de Spa-Francorchamps');

    expect(sections[0].name).toBe('La Source');
    expect(sections[1].name).toBe('Eau Rouge');
    for (let i = 1; i < sections.length; i += 1) {
      expect(sections[i].start_pct).toBeGreaterThanOrEqual(
        sections[i - 1].start_pct
      );
    }
  });

  it('gives nothing for a circuit the dataset does not have', () => {
    expect(sectionsFor('Fuji Speedway')).toEqual([]);
    expect(sectionsFor('Bahrain International Circuit')).toEqual([]);
  });
});

describe('loadLmuTrackData', () => {
  it('keys on the name LMU publishes, lowercased', () => {
    // The whole reason the LMU dataset needs no matching: its ids are LMU's
    // own display names with the case dropped.
    expect(loadLmuTrackData('Fuji Speedway')?.trackId).toBe('fuji speedway');
    expect(loadLmuTrackData('Bahrain Endurance Circuit')?.trackId).toBe(
      'bahrain endurance circuit'
    );
    expect(loadLmuTrackData('Circuit de la Sarthe')?.trackId).toBe(
      'circuit de la sarthe'
    );
  });

  it('keeps layouts of one circuit apart', () => {
    // Four Bahrains and two Fujis. Collapsing any pair would put one layout's
    // corners on another.
    const ids = [
      'Bahrain International Circuit',
      'Bahrain Endurance Circuit',
      'Bahrain Outer Circuit',
      'Bahrain Paddock Circuit',
    ].map((name) => loadLmuTrackData(name)?.trackId);

    expect(new Set(ids).size).toBe(4);
    expect(loadLmuTrackData('Fuji Speedway Classic')?.trackId).toBe(
      'fuji speedway classic'
    );
  });

  it('matches an accented name', () => {
    expect(loadLmuTrackData('Autódromo José Carlos Pace')?.trackId).toBe(
      'autódromo josé carlos pace'
    );
  });

  it('does not guess', () => {
    // Exact only. The near-miss matching on the iRacing side is what answered
    // "Michelin Raceway Road Atlanta" with "daytona 2011 road".
    expect(loadLmuTrackData('Long Beach Street Circuit')).toBeNull();
    expect(loadLmuTrackData('Fuji')).toBeNull();
    expect(loadLmuTrackData('')).toBeNull();
  });

  it('gives every bundled layout usable corners', () => {
    // A layout whose turns carry only a marker produces no sections at all --
    // which is the state Long Beach is in on the iRacing side. Worth knowing
    // if it ever becomes true here.
    const tracks = getAvailableLmuTracks();
    expect(tracks.length).toBe(21);
    for (const { trackId } of tracks) {
      // The id is the key -- the dataset's `name` is its own prettier label.
      const raw = loadLmuTrackData(trackId);
      const usable = (raw?.turn ?? []).filter(
        (t) => t.start !== undefined && t.end !== undefined
      );
      expect(usable.length, trackId).toBeGreaterThan(0);
    }
  });
});

describe('the LMU circuits that used to be blank', () => {
  /** Exactly the order the shared hook tries. */
  const sectionsFor = (trackName: string) => {
    const alias = lmuTrackDataId(trackName);
    const raw =
      loadLmuTrackData(trackName) ??
      (alias ? loadTrackData(alias) : null) ??
      loadTrackData(trackName);
    return raw ? mapLovelyToTrackData(raw).sections : [];
  };

  it('names Fuji, which had nothing before', () => {
    const sections = sectionsFor('Fuji Speedway');
    const names = sections.map((s) => s.name);

    expect(sections.length).toBeGreaterThan(10);
    expect(names).toContain('Coca Cola');
    expect(names).toContain('100 R');
  });

  it('numbers an unnamed turn from the dataset, not from a running count', () => {
    // Fuji's turn 2 has no name and is the first unnamed one, so the counter
    // called it "Turn 1". Bahrain has no names at all and would have been
    // renumbered from 1 regardless.
    const fuji = sectionsFor('Fuji Speedway');
    const first = fuji.find((s) => s.name === '1st');

    expect(first).toBeDefined();
    expect(fuji.map((s) => s.name)).toContain('Turn 2');
    expect(fuji.map((s) => s.name)).not.toContain('Turn 1');
  });

  it('names every Bahrain layout separately', () => {
    const endurance = sectionsFor('Bahrain Endurance Circuit');
    const outer = sectionsFor('Bahrain Outer Circuit');

    expect(endurance.length).toBeGreaterThan(20);
    expect(outer.length).toBeGreaterThan(5);
    expect(endurance.length).not.toBe(outer.length);
  });

  it('still falls back to the iRacing dataset where LMU has no entry', () => {
    // Laguna Seca and Road Atlanta are not in the LMU dataset.
    expect(sectionsFor('WeatherTech Raceway Laguna Seca').length).toBe(11);
    expect(
      sectionsFor('Michelin Raceway Road Atlanta').map((s) => s.name)
    ).toContain('The Esses');
  });

  it('gives nothing for a circuit neither dataset has', () => {
    expect(sectionsFor('Long Beach Street Circuit')).toEqual([]);
  });
});
