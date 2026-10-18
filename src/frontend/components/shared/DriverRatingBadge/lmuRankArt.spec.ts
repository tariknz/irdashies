import { describe, expect, it } from 'vitest';
import { lmuArtCounts, lmuBadgeArt, lmuRankArt } from './lmuRankArt';
import { LMU_TIERED_RANKS } from '@irdashies/types';
import { lmuUsesRankArt, LMU_ART_BADGE_FORMAT } from './lmuUsesRankArt';

/**
 * The bundled LMU artwork, and the lookups into it.
 *
 * These assert that the files are actually there, which is the point: the art
 * is committed rather than fetched at runtime, so a missing file is a missing
 * file for every user until someone runs the fetch tool again. A lookup that
 * silently returns undefined would show as a text chip and nobody would know
 * the plate was meant to be there.
 */
describe('bundled LMU artwork', () => {
  it('has a plate for every rank and tier, for both ratings', () => {
    // 2 kinds x 4 ranks x 4 tiers. Run tools/fetch-lmu-rank-art.ts if short.
    expect(lmuArtCounts().ranks).toBe(32);
  });

  it('has all five achievement badges', () => {
    expect(lmuArtCounts().badges).toBe(5);
  });

  it('resolves every tiered rank for both kinds', () => {
    for (const kind of ['dr', 'sr'] as const) {
      for (const rank of LMU_TIERED_RANKS) {
        for (const tier of [0, 1, 2, 3]) {
          expect(lmuRankArt(kind, rank, tier)).toBeTruthy();
        }
      }
    }
  });

  it('gives the driver and safety ratings different art', () => {
    // Keyed by kind, so a Silver 2 safety rank is not drawn with the driver
    // plate -- they are visually distinct in the sim.
    expect(lmuRankArt('dr', 'Silver', 2)).not.toBe(
      lmuRankArt('sr', 'Silver', 2)
    );
  });

  it('treats a missing tier as tier 0', () => {
    // Which is the bucket's own spelling of a rank that carries no tier.
    expect(lmuRankArt('dr', 'Bronze')).toBe(lmuRankArt('dr', 'Bronze', 0));
  });

  it('has no plate for Pro', () => {
    // The bucket carries none; LMUTraceHUB falls back to a text label too.
    expect(lmuRankArt('dr', 'Pro', 1)).toBeUndefined();
    expect(lmuRankArt('sr', 'Pro')).toBeUndefined();
  });

  it('resolves each known badge and nothing else', () => {
    for (const badge of [
      'sr-noob',
      'sr-saint',
      'sr-clean',
      'sr-warning',
      'sr-probation',
    ]) {
      expect(lmuBadgeArt(badge)).toBeTruthy();
    }
    // A marker the service invents later is simply not drawn.
    expect(lmuBadgeArt('sr-unheard-of')).toBeUndefined();
    expect(lmuBadgeArt(undefined)).toBeUndefined();
  });
});

describe('lmuUsesRankArt', () => {
  it('picks the art for the first badge format only', () => {
    // The format setting describes an iRacing licence and iRating, which maps
    // onto nothing in LMU, so it is read here as one question: plates or text.
    expect(lmuUsesRankArt(LMU_ART_BADGE_FORMAT)).toBe(true);
    expect(lmuUsesRankArt('license-color-rating-bw')).toBe(false);
    expect(lmuUsesRankArt('rating-bw-no-license')).toBe(false);
    expect(lmuUsesRankArt(undefined)).toBe(false);
  });
});
