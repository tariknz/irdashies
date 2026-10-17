import { describe, expect, it } from 'vitest';
import type { LapInvalidReason } from '@irdashies/types';
import { invalidLapMessage } from './invalidLapMessage';

/**
 * Every reason the recorder can produce. Listed by hand rather than derived,
 * so adding a reason to the union without deciding what to tell the driver
 * fails here as well as at the type level.
 */
const ALL_REASONS: LapInvalidReason[] = [
  'out-lap',
  'partial-lap',
  'reset',
  'pitted',
  'off-world',
  'incident',
  'sim-invalidated',
  'spin',
  'discontinuity',
  'too-long',
];

describe('invalidLapMessage', () => {
  it.each(ALL_REASONS)('has something to say about %s', (reason) => {
    expect(invalidLapMessage(reason)).toBeTruthy();
  });

  it('distinguishes leaving the pits from entering them', () => {
    expect(invalidLapMessage('out-lap')).toMatch(/out-lap/i);
    expect(invalidLapMessage('pitted')).toMatch(/pit lap/i);
  });

  it('claims no cause for a lap the sim simply voided', () => {
    // LMU reports a bare flag. Naming track limits, or anything else, would
    // be inventing a reason it never gave.
    expect(invalidLapMessage('sim-invalidated')).toBe(
      'Lap invalidated by the sim'
    );
  });

  it('keeps every message short enough for a narrow widget', () => {
    for (const reason of ALL_REASONS) {
      expect(invalidLapMessage(reason).length).toBeLessThanOrEqual(52);
    }
  });
});
