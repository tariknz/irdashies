import { describe, expect, it } from 'vitest';
import { compareMenuLabels } from './menuLabelOrder';
import { widgetItems } from './menuItems';

describe('menu label order', () => {
  it('sorts numbers naturally and ignores case', () => {
    expect(
      ['Lap Timer 10', 'radar', 'Lap Timer 2', 'Input'].sort(compareMenuLabels)
    ).toEqual(['Input', 'Lap Timer 2', 'Lap Timer 10', 'radar']);
  });

  it('is the order of the widget menu items, as in the flat lists', () => {
    const labels = widgetItems.map((item) => item.label);
    expect(labels).toEqual([...labels].sort(compareMenuLabels));
  });
});
