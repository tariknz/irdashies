import { beforeEach, describe, expect, it } from 'vitest';
import type { MenuItem } from './menuItems';
import {
  DEFAULT_MENU_SORT,
  nextMenuSort,
  readMenuSort,
  saveMenuSort,
  sortMenuItems,
} from './menuSort';

const item = (label: string, widgetType?: string): MenuItem => ({
  to: `/settings/${label}`,
  path: `/${label}`,
  label,
  widgetType,
});

describe('menu sort', () => {
  beforeEach(() => localStorage.clear());

  it('steps through by category, alphabetical and activated first, then round', () => {
    expect(nextMenuSort('category')).toBe('alpha');
    expect(nextMenuSort('alpha')).toBe('activated');
    expect(nextMenuSort('activated')).toBe('category');
  });

  it('is by category until an order is chosen, and remembers the one chosen', () => {
    expect(readMenuSort()).toBe(DEFAULT_MENU_SORT);
    expect(DEFAULT_MENU_SORT).toBe('category');
    saveMenuSort('activated');
    expect(readMenuSort()).toBe('activated');
  });

  it('ignores a stored order it does not know', () => {
    localStorage.setItem('settingsMenuSort', 'sideways');
    expect(readMenuSort()).toBe('category');
  });

  it('sorts alphanumerically, ignoring case', () => {
    const items = [
      item('Lap Timer 10'),
      item('radar'),
      item('Lap Timer 2'),
      item('Input'),
    ];
    expect(
      sortMenuItems(items, 'alpha', () => false).map((i) => i.label)
    ).toEqual(['Input', 'Lap Timer 2', 'Lap Timer 10', 'radar']);
  });

  it('puts the activated items first, each part alphanumeric', () => {
    const on = new Set(['Standings', 'Fuel']);
    const items = [
      item('Standings'),
      item('Battle'),
      item('Fuel'),
      item('Weather'),
      item('Delta'),
    ];
    expect(
      sortMenuItems(items, 'activated', (i) => on.has(i.label)).map(
        (i) => i.label
      )
    ).toEqual(['Fuel', 'Standings', 'Battle', 'Delta', 'Weather']);
  });
});
