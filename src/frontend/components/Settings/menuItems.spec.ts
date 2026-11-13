import { describe, expect, it } from 'vitest';
import { toolItems, widgetItems } from './menuItems';
import { settingsPageKind } from './settingsPageKind';

describe('toolItems', () => {
  it('classifies every tool page separately from overlay settings', () => {
    expect(toolItems.map((item) => item.to)).toContain('/settings/race-plan');
    for (const item of toolItems) {
      expect(settingsPageKind(item.to), item.label).toBe('tool');
      expect(
        widgetItems.some((widget) => widget.to === item.to),
        item.label
      ).toBe(false);
    }
  });
});
