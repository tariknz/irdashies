import { describe, expect, it } from 'vitest';
import { toolItems } from './menuItems';

describe('toolItems', () => {
  it('puts every tool in the Tools section, the only place the menu lists them', () => {
    for (const item of toolItems) {
      expect(item.category, item.label).toBe('Tools');
    }
  });
});
