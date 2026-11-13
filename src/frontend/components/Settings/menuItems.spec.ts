import { describe, expect, it } from 'vitest';
import { toolItems, widgetItems } from './menuItems';
import { settingsPageKind } from './settingsPageKind';

describe('toolItems', () => {
  it('puts every tool in the Tools section, the only place the menu lists them', () => {
    expect(toolItems.map((item) => item.to)).toContain('/settings/race-plan');
    for (const item of toolItems) {
      expect(item.category, item.label).toBeUndefined();
      expect(settingsPageKind(item.to), item.label).toBe('tool');
      expect(
        widgetItems.some(({ to }) => to === item.to),
        item.label
      ).toBe(false);
    }
  });
});
