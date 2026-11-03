import { describe, expect, it } from 'vitest';
import {
  DEMO_DAMAGE,
  UNDAMAGED,
  aeroIntegrity,
  bodyIntegrity,
  bodyTier,
  hasCarDamage,
  integrityFraction,
  iracingBodyTier,
  isPunctured,
  suspTier,
  suspensionIntegrity,
  tyreIntegrity,
  tyreWearTier,
} from './logic';

describe('damage logic', () => {
  it('tiers body severity', () => {
    expect(bodyTier(0)).toBe('ok');
    expect(bodyTier(1)).toBe('light');
    expect(bodyTier(2)).toBe('heavy');
    expect(bodyTier(3)).toBe('detached');
  });

  it('tiers suspension by TinyPedal thresholds', () => {
    expect(suspTier(false, 0)).toBe('ok');
    expect(suspTier(false, 0.1)).toBe('light');
    expect(suspTier(false, 0.3)).toBe('medium');
    expect(suspTier(false, 0.5)).toBe('heavy');
    expect(suspTier(false, 0.9)).toBe('totaled');
    expect(suspTier(true, 0)).toBe('detached');
  });

  it('tiers tyre wear for iRacing wheels', () => {
    expect(tyreWearTier(1)).toBe('ok');
    expect(tyreWearTier(0.6)).toBe('light');
    expect(tyreWearTier(0.3)).toBe('medium');
    expect(tyreWearTier(0.1)).toBe('heavy');
    expect(tyreWearTier(0.005)).toBe('detached');
  });

  it('maps iRacing repair flags to a coarse body tier', () => {
    expect(iracingBodyTier(false, false)).toBe('ok');
    expect(iracingBodyTier(false, true)).toBe('light');
    expect(iracingBodyTier(true, true)).toBe('heavy');
  });

  it('prefers aero for centre integrity when available', () => {
    expect(integrityFraction(0.2, [2, 2, 2, 2, 2, 2, 2, 2])).toBeCloseTo(0.8);
    expect(integrityFraction(undefined, [2, 2, 2, 2, 2, 2, 2, 2])).toBeCloseTo(
      0
    );
    expect(integrityFraction(-1, [])).toBeNull();
  });

  it('computes stats integrities', () => {
    expect(aeroIntegrity(0.25)).toBeCloseTo(0.75);
    expect(bodyIntegrity([1, 1, 1, 1, 1, 1, 1, 1])).toBeCloseTo(0.5);
    expect(bodyIntegrity([])).toBeNull();
    expect(suspensionIntegrity([0.1, 0.4, 0.2, 0.05], [])).toBeCloseTo(0.6);
    expect(suspensionIntegrity([], [false, true, false, false])).toBe(0);
    expect(suspensionIntegrity([], [false, false, false, false])).toBeNull();
    expect(tyreIntegrity([0.9, 0.8, 0.7, 0.6])).toBeCloseTo(0.6);
    expect(isPunctured(0.005)).toBe(true);
    expect(isPunctured(0.5)).toBe(false);
  });

  it('detects damage without treating normal tyre wear as damage', () => {
    expect(hasCarDamage(UNDAMAGED)).toBe(false);
    expect(hasCarDamage(DEMO_DAMAGE)).toBe(true);
    expect(
      hasCarDamage({
        ...UNDAMAGED,
        tyreWear: [0.7, 0.8, 0.75, 0.9],
      })
    ).toBe(false);
    expect(
      hasCarDamage({
        ...UNDAMAGED,
        tyreWear: [1, 1, 0.005, 1],
      })
    ).toBe(true);
    expect(
      hasCarDamage({
        ...UNDAMAGED,
        repairNeeded: true,
      })
    ).toBe(true);
  });
});
