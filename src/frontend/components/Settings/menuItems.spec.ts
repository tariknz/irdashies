import { describe, expect, it } from 'vitest';
import { broadcastItems, toolItems, widgetItems } from './menuItems';
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

describe('broadcastItems', () => {
  it('gives every broadcast widget a page in the Broadcast menu, opened from its one overlay row', () => {
    const broadcastRow = widgetItems.find((item) => item.groupTypes);
    expect(broadcastRow?.label).toBe('Broadcast');
    expect(broadcastItems.map((item) => item.widgetType)).toEqual(
      broadcastRow?.groupTypes
    );
    for (const item of broadcastItems) {
      expect(settingsPageKind(item.to), item.label).toBe('broadcast');
      expect(item.icon, item.label).toBeDefined();
    }
  });
});
