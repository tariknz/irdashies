import { describe, expect, it } from 'vitest';
import {
  BROADCAST_SETTINGS_PAGE,
  broadcastItems,
  toolItems,
  widgetItems,
} from './menuItems';
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
    expect(broadcastItems.flatMap((item) => item.widgetType ?? [])).toEqual(
      broadcastRow?.groupTypes
    );
    for (const item of broadcastItems) {
      expect(settingsPageKind(item.to), item.label).toBe('broadcast');
      expect(item.icon, item.label).toBeDefined();
    }
  });

  it('ends with the Settings page, shared by every module', () => {
    const settings = broadcastItems.at(-1);
    expect(settings?.label).toBe('Settings');
    expect(settings?.to).toBe(BROADCAST_SETTINGS_PAGE);
    expect(settings?.widgetType).toBeUndefined();
  });
});
