import { describe, expect, it } from 'vitest';
import { applyUpdateThreshold, clampMagnitude } from './displayValue';

describe('clampMagnitude', () => {
  it('leaves a value inside the cap alone', () => {
    expect(clampMagnitude(5.4, 9)).toBe(5.4);
  });

  it('caps a positive value', () => {
    expect(clampMagnitude(9.1, 9)).toBe(9);
  });

  it('caps a negative value, preserving the sign', () => {
    expect(clampMagnitude(-12.7, 9)).toBe(-9);
  });

  it('leaves zero at zero', () => {
    expect(clampMagnitude(0, 9)).toBe(0);
  });

  it('treats a non-positive cap as no cap', () => {
    expect(clampMagnitude(42, 0)).toBe(42);
    expect(clampMagnitude(42, -1)).toBe(42);
  });
});

describe('applyUpdateThreshold', () => {
  it('shows the first value as-is', () => {
    expect(applyUpdateThreshold(1.3, null, 0.2)).toBe(1.3);
  });

  it('holds when the value has not moved far enough', () => {
    expect(applyUpdateThreshold(1.4, 1.3, 0.2)).toBe(1.3);
  });

  it('updates once the value moves by the threshold', () => {
    expect(applyUpdateThreshold(1.5, 1.3, 0.2)).toBe(1.5);
  });

  it('updates on a move larger than the threshold', () => {
    expect(applyUpdateThreshold(4, 1.3, 0.2)).toBe(4);
  });

  it('holds symmetrically in the negative direction', () => {
    expect(applyUpdateThreshold(1.2, 1.3, 0.2)).toBe(1.3);
    expect(applyUpdateThreshold(1.1, 1.3, 0.2)).toBe(1.1);
  });

  it('is disabled by a non-positive threshold', () => {
    expect(applyUpdateThreshold(1.4, 1.3, 0)).toBe(1.4);
    expect(applyUpdateThreshold(1.4, 1.3, -1)).toBe(1.4);
  });

  it('is idempotent, so it is safe to call during render', () => {
    const first = applyUpdateThreshold(1.4, 1.3, 0.2);
    expect(applyUpdateThreshold(1.4, first, 0.2)).toBe(first);

    const moved = applyUpdateThreshold(1.6, 1.3, 0.2);
    expect(applyUpdateThreshold(1.6, moved, 0.2)).toBe(moved);
  });

  it('suppresses the flicker it exists to prevent', () => {
    // The reported annoyance: a steady delta jittering across a 0.1 boundary.
    const samples = [1.1, 1.2, 1.1, 1.2, 1.1];
    let held: number | null = null;
    const shown = samples.map((s) => {
      held = applyUpdateThreshold(s, held, 0.2);
      return held;
    });

    expect(shown).toEqual([1.1, 1.1, 1.1, 1.1, 1.1]);
  });

  it('still tracks a delta that genuinely drifts', () => {
    const samples = [1.0, 1.25, 1.5, 1.75, 2.0];
    let held: number | null = null;
    const shown = samples.map((s) => {
      held = applyUpdateThreshold(s, held, 0.2);
      return held;
    });

    expect(shown).toEqual(samples);
  });
});
