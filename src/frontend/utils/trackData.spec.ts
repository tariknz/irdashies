import { describe, expect, it } from 'vitest';
import { loadTrackData } from './trackData';

describe('loadTrackData', () => {
  it.each(['Imola', 'Imola 2023', 'Autodromo Enzo e Dino Ferrari'])(
    'matches LMU Imola name %s',
    (trackName) => {
      expect(loadTrackData(trackName)?.trackId).toBe('imola gp');
    }
  );
});
