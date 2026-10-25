import { describe, expect, it } from 'vitest';
import { menuHasToggle, widgetItems } from './menuItems';

describe('menuHasToggle', () => {
  it('is true for a listed widget that exists in the dashboard', () => {
    expect(menuHasToggle('fuel', ['fuel', 'relative'])).toBe(true);
  });

  it('is false when the widget is not in the dashboard', () => {
    expect(menuHasToggle('fuel', ['relative'])).toBe(false);
  });

  it('is false for widgets hidden from the menu or sharing a page', () => {
    const noSwitch = widgetItems.filter(
      (item) => item.hideInMenu || item.groupTypes
    );
    expect(noSwitch.length).toBeGreaterThan(0);
    for (const item of noSwitch) {
      expect(
        menuHasToggle(item.widgetType ?? '', [item.widgetType ?? ''])
      ).toBe(false);
    }
  });
});
