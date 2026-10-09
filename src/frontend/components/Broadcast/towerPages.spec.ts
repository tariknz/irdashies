import { describe, expect, it } from 'vitest';
import { pickTransition, TRANSITIONS } from './towerPages';
import { formatSpeed } from './components/TowerCards';

describe('pickTransition', () => {
  it('uses a fixed transition every time', () => {
    expect(pickTransition('flip', 'flip')).toBe('flip');
  });

  it('never repeats the last one when random', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickTransition('random', 'wipe')).not.toBe('wipe');
    }
  });

  it('falls back to random for a value it does not know', () => {
    expect(TRANSITIONS).toContain(pickTransition('sparkle'));
    expect(TRANSITIONS).toContain(pickTransition(undefined));
  });
});

describe('formatSpeed', () => {
  it("follows the sim's display units", () => {
    expect(formatSpeed(160.9344, 0)).toBe('100 mph');
    expect(formatSpeed(160.9344, 1)).toBe('161 km/h');
    expect(formatSpeed(160.9344, undefined)).toBe('161 km/h');
  });
});
