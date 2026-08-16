import { describe, expect, it } from 'vitest';
import { clientXToViewBoxX } from './LapGapChart';

describe('clientXToViewBoxX', () => {
  it('maps the horizontally letterboxed drawing instead of the full element', () => {
    const rect = { left: 100, width: 1120, height: 240 };

    expect(clientXToViewBoxX(380, rect, 560, 240)).toBe(0);
    expect(clientXToViewBoxX(660, rect, 560, 240)).toBe(280);
    expect(clientXToViewBoxX(940, rect, 560, 240)).toBe(560);
  });

  it('clamps pointer positions in the letterbox bars to the viewBox edges', () => {
    const rect = { left: 100, width: 1120, height: 240 };

    expect(clientXToViewBoxX(100, rect, 560, 240)).toBe(0);
    expect(clientXToViewBoxX(1220, rect, 560, 240)).toBe(560);
  });

  it('preserves direct mapping when only vertical letterboxing is present', () => {
    const rect = { left: 100, width: 560, height: 480 };

    expect(clientXToViewBoxX(380, rect, 560, 240)).toBe(280);
  });
});
