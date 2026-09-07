import { describe, it, expect } from 'vitest';
import { TrackLocation } from '@irdashies/types';
import { isPitSurface, isOffTrackSurface } from './useLapTimeLog';

/**
 * These map `PlayerTrackSurface` onto `TrackLocation`, and getting that mapping
 * wrong is silent: the value simply never matches and the check quietly does
 * nothing. That is exactly what happened before — off-track was compared
 * against a hardcoded 4, which `TrackLocation` cannot produce, so no lap was
 * ever marked dirty for going off. Every enum member is asserted so a future
 * edit has to be deliberate.
 */
describe('track surface predicates', () => {
  const everySurface = [
    TrackLocation.NotInWorld,
    TrackLocation.OffTrack,
    TrackLocation.InPitStall,
    TrackLocation.ApproachingPits,
    TrackLocation.OnTrack,
  ];

  describe('isPitSurface', () => {
    it('is true in the pit box and in the pit lane', () => {
      expect(isPitSurface(TrackLocation.InPitStall)).toBe(true);
      expect(isPitSurface(TrackLocation.ApproachingPits)).toBe(true);
    });

    it('is false everywhere else', () => {
      expect(isPitSurface(TrackLocation.OnTrack)).toBe(false);
      expect(isPitSurface(TrackLocation.OffTrack)).toBe(false);
      expect(isPitSurface(TrackLocation.NotInWorld)).toBe(false);
    });

    it('matches exactly two of the five surfaces', () => {
      // Guards against a predicate that is accidentally always true or false.
      expect(everySurface.filter(isPitSurface)).toEqual([
        TrackLocation.InPitStall,
        TrackLocation.ApproachingPits,
      ]);
    });
  });

  describe('isOffTrackSurface', () => {
    it('is true off track', () => {
      expect(isOffTrackSurface(TrackLocation.OffTrack)).toBe(true);
    });

    it('is not true for a value the enum cannot take', () => {
      // The original bug: 4 is outside TrackLocation, so the comparison could
      // never succeed and going off never marked a lap dirty.
      expect(isOffTrackSurface(4)).toBe(false);
    });

    it('matches exactly one of the five surfaces', () => {
      expect(everySurface.filter(isOffTrackSurface)).toEqual([
        TrackLocation.OffTrack,
      ]);
    });
  });
});
