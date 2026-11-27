import { describe, expect, it } from 'vitest';
import {
  BROADCAST_SETTINGS_PAGE,
  generalItems,
  menuHasToggle,
  toolItems,
  widgetItems,
} from './menuItems';
import { settingsPageKind } from './settingsPageKind';
import { BROADCAST_MODULE_TYPES } from './broadcastModules';

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

describe('Broadcast navigation', () => {
  it('lists each broadcast widget under Broadcast with its own switch', () => {
    for (const type of BROADCAST_MODULE_TYPES) {
      expect(
        widgetItems.filter(
          (item) => item.widgetType === type && !item.hideInMenu
        )
      ).toEqual([
        expect.objectContaining({
          to: `/settings/${type}`,
          category: 'Broadcast',
        }),
      ]);
      expect(settingsPageKind(`/settings/${type}`)).toBe('overlay');
      expect(menuHasToggle(type, [type])).toBe(true);
    }
  });

  it('lists the shared settings page under App settings', () => {
    const settings = generalItems.find(
      (item) => item.to === BROADCAST_SETTINGS_PAGE
    );
    expect(settings?.label).toBe('Broadcast Settings');
    expect(settings?.widgetType).toBeUndefined();
    expect(settingsPageKind(BROADCAST_SETTINGS_PAGE)).toBe('app');
    expect(
      widgetItems.some((item) => item.to === BROADCAST_SETTINGS_PAGE)
    ).toBe(false);
  });
});
