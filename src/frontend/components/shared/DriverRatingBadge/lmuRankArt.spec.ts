import { describe, expect, it } from 'vitest';
import {
  LMU_ART_HEIGHT_EM,
  lmuArtCounts,
  lmuBadgeArt,
  lmuRankArt,
} from './lmuRankArt';
import { LMU_TIERED_RANKS } from '@irdashies/types';

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
    // toEqual, not toBe: a cell is built per call now rather than being a
    // URL string looked up from a map.
    expect(lmuRankArt('dr', 'Bronze')).toEqual(lmuRankArt('dr', 'Bronze', 0));
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

describe('sprite cells', () => {
  it('draws every piece of art at one height', () => {
    // The plates and the badge sit side by side; a difference reads as a bug.
    expect(lmuRankArt('dr', 'Gold', 3)?.heightEm).toBe(LMU_ART_HEIGHT_EM);
    expect(lmuBadgeArt('sr-saint')?.heightEm).toBe(LMU_ART_HEIGHT_EM);
  });

  it('keeps the plate aspect, so the art is not squashed', () => {
    // The source plates are 112x52, so a cell is wider than it is tall.
    const plate = lmuRankArt('dr', 'Gold', 3);
    expect(plate?.widthEm).toBeCloseTo((LMU_ART_HEIGHT_EM * 112) / 52, 5);
  });

  it('keeps badges square', () => {
    const badge = lmuBadgeArt('sr-saint');
    expect(badge?.widthEm).toBe(badge?.heightEm);
  });

  it('sizes the background to the whole sheet', () => {
    // background-size covers the sheet and background-position selects the
    // cell; getting this wrong shows the wrong rank rather than nothing.
    const plate = lmuRankArt('dr', 'Bronze', 0);
    const width = (LMU_ART_HEIGHT_EM * 112) / 52;
    expect(plate?.backgroundSize).toBe(
      `${8 * width}em ${4 * LMU_ART_HEIGHT_EM}em`
    );
  });

  it('offsets to the right cell', () => {
    // dr-Bronze0 is the first cell, so no offset at all.
    expect(lmuRankArt('dr', 'Bronze', 0)?.backgroundPosition).toBe('0em 0em');
    // Every other cell is a negative offset into the sheet.
    expect(lmuRankArt('sr', 'Platinum', 3)?.backgroundPosition).not.toBe(
      '0em 0em'
    );
  });

  it('gives each cell of the pair a different offset', () => {
    // Keyed by kind, so a Silver 2 safety rank is not drawn with the driver
    // plate -- they are visually distinct in the sim.
    expect(lmuRankArt('dr', 'Silver', 2)?.backgroundPosition).not.toBe(
      lmuRankArt('sr', 'Silver', 2)?.backgroundPosition
    );
  });

  it('serves the plates and the badges from one sheet each', () => {
    // The whole point: one decode per sheet rather than thirty-seven.
    const urls = new Set<string>();
    for (const kind of ['dr', 'sr'] as const) {
      for (const rank of LMU_TIERED_RANKS) {
        urls.add(lmuRankArt(kind, rank, 1)?.url ?? '');
      }
    }
    expect(urls.size).toBe(1);

    const badgeUrls = new Set(
      ['sr-noob', 'sr-saint', 'sr-clean'].map((b) => lmuBadgeArt(b)?.url ?? '')
    );
    expect(badgeUrls.size).toBe(1);
  });
});
