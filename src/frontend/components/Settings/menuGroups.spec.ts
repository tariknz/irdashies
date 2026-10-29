import { describe, expect, it } from 'vitest';
import {
  addGroup,
  groupOf,
  moveWidget,
  removeGroup,
  toggleCollapsed,
} from './menuGroups';

const builtIn = ['race', 'car'];

describe('menuGroups', () => {
  it('moves a widget into a custom group and back to its default', () => {
    const added = addGroup(undefined, ' Mine ');
    const id = added.groups?.[0].id ?? '';
    expect(added.groups?.[0].label).toBe('Mine');
    const moved = moveWidget(added, 'fuel', id, 'car');
    expect(groupOf('fuel', 'car', moved, builtIn)).toBe(id);
    const back = moveWidget(moved, 'fuel', 'car', 'car');
    expect(groupOf('fuel', 'car', back, builtIn)).toBe('car');
  });

  it('falls back to the default when the group is removed', () => {
    const added = addGroup(undefined, 'Mine');
    const id = added.groups?.[0].id ?? '';
    const moved = toggleCollapsed(moveWidget(added, 'fuel', id, 'car'), id);
    const removed = removeGroup(moved, id);
    expect(groupOf('fuel', 'car', removed, builtIn)).toBe('car');
    expect(removed.collapsed).toEqual([]);
  });

  it('opens a collapsed group a widget is dropped into', () => {
    const moved = moveWidget(
      toggleCollapsed(undefined, 'car'),
      'fuel',
      'car',
      'race'
    );
    expect(moved.collapsed).toEqual([]);
  });

  it('toggles collapsed', () => {
    const once = toggleCollapsed(undefined, 'race');
    expect(once.collapsed).toEqual(['race']);
    expect(toggleCollapsed(once, 'race').collapsed).toEqual([]);
  });
});
