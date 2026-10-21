import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LMU_TRACK_DATA_IDS, lmuTrackDataId } from './lmuTrackAliases';

interface LovelyTurn {
  name?: string;
  start?: number;
  end?: number;
}

/**
 * Read rather than imported, to keep a 2 MB dataset out of this module's
 * import graph; the production lookup loads it through the frontend bundle.
 */
const bundle = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'src/frontend/assets/data/tracks-bundle.json'),
    'utf8'
  )
) as { tracks: Record<string, { turn?: LovelyTurn[] }> };

describe('LMU_TRACK_DATA_IDS', () => {
  it('points every entry at a track the dataset actually has', () => {
    // A typo'd id resolves to nothing and the widget silently shows no
    // corners, which is indistinguishable from the circuit having no data.
    const missing = Object.entries(LMU_TRACK_DATA_IDS).filter(
      ([, id]) => !(id in bundle.tracks)
    );

    expect(missing).toEqual([]);
  });

  it('points at entries that carry named corners with ranges', () => {
    // The point of the table. An id whose turns have no start/end would map to
    // nothing usable -- mapLovelyToTrackData drops a marker-only turn.
    const withoutRanges = Object.entries(LMU_TRACK_DATA_IDS).filter(
      ([, id]) =>
        !(bundle.tracks[id].turn ?? []).some(
          (turn) =>
            turn.name !== undefined &&
            turn.start !== undefined &&
            turn.end !== undefined
        )
    );

    // Daytona's road course is marker-only in the dataset, so it is the one
    // entry that cannot produce sections. Kept because the map generator uses
    // the same table and does want its geometry.
    expect(withoutRanges.map(([name]) => name)).toEqual([
      'Daytona International Speedway Road Course',
    ]);
  });
});

describe('lmuTrackDataId', () => {
  it('resolves a name LMU publishes', () => {
    expect(lmuTrackDataId('WeatherTech Raceway Laguna Seca')).toBe(
      'lagunaseca'
    );
    expect(lmuTrackDataId('Circuit de la Sarthe')).toBe('lemans full');
    // Two layouts of one circuit have to stay distinct.
    expect(lmuTrackDataId('Circuit de la Sarthe Mulsanne')).toBe(
      'lemans nochicane'
    );
  });

  it('resolves an accented name whatever case it arrives in', () => {
    expect(lmuTrackDataId('Autódromo José Carlos Pace')).toBe('interlagos gp');
    expect(lmuTrackDataId('autódromo josé carlos pace')).toBe('interlagos gp');
  });

  it('leaves an iRacing name alone', () => {
    // iRacing's own names must fall through to the dataset unchanged.
    expect(lmuTrackDataId('lagunaseca')).toBeUndefined();
    expect(lmuTrackDataId('nurburgring nordschleife')).toBeUndefined();
  });

  it('answers nothing for a circuit with no entry', () => {
    // Fuji, Bahrain, Lusail and Paul Ricard are not in the dataset under any
    // spelling. No corner names beats another circuit's.
    expect(lmuTrackDataId('Fuji Speedway')).toBeUndefined();
    expect(lmuTrackDataId('Bahrain International Circuit')).toBeUndefined();
    expect(lmuTrackDataId('Lusail International Circuit')).toBeUndefined();
    expect(lmuTrackDataId(undefined)).toBeUndefined();
    expect(lmuTrackDataId('')).toBeUndefined();
  });
});
