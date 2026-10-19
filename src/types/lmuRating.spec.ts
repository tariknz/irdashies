import { describe, expect, it } from 'vitest';
import { LMU_BADGE_FORMATS, lmuChipChrome } from './lmuRating';

/**
 * How an LMU rank pair is drawn.
 *
 * Its own set of formats rather than a thirteenth iRacing one: those describe
 * a licence class beside a four-digit iRating and map onto nothing in a named
 * rank with a tier. What varies here is only which of the pair keeps its
 * background and border.
 */
describe('lmuChipChrome', () => {
  it('keeps both backgrounds for chip-both', () => {
    expect(lmuChipChrome('chip-both')).toEqual({ driver: true, safety: true });
  });

  it('keeps the driver background only for chip-dr', () => {
    expect(lmuChipChrome('chip-dr')).toEqual({ driver: true, safety: false });
  });

  it('keeps the safety background only for chip-sr', () => {
    expect(lmuChipChrome('chip-sr')).toEqual({ driver: false, safety: true });
  });

  it('drops both for chip-none', () => {
    expect(lmuChipChrome('chip-none')).toEqual({
      driver: false,
      safety: false,
    });
  });

  it('keeps both for anything it does not recognise', () => {
    // The fuller rendering is the safer default: a chip with no background on
    // an unexpected one could be unreadable, where an extra border cannot.
    expect(lmuChipChrome(undefined)).toEqual({ driver: true, safety: true });
    expect(lmuChipChrome('plates')).toEqual({ driver: true, safety: true });
  });
});

describe('LMU_BADGE_FORMATS', () => {
  it('offers the plates and the four chip arrangements', () => {
    expect(LMU_BADGE_FORMATS).toEqual([
      'plates',
      'chip-both',
      'chip-dr',
      'chip-sr',
      'chip-none',
    ]);
  });
});
