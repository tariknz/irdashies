import { describe, expect, it, vi } from 'vitest';
import {
  getHiddenWidgets,
  onWidgetHiddenChanged,
  toggleWidgetHidden,
} from './widgetVisibility';

describe('widgetVisibility', () => {
  it('toggles a widget and tells listeners', () => {
    const cb = vi.fn();
    const off = onWidgetHiddenChanged(cb);

    expect(toggleWidgetHidden('broadcast')).toBe(true);
    expect(getHiddenWidgets()).toEqual(['broadcast']);
    expect(toggleWidgetHidden('broadcast')).toBe(false);
    expect(getHiddenWidgets()).toEqual([]);
    expect(cb.mock.calls).toEqual([
      ['broadcast', true],
      ['broadcast', false],
    ]);
    off();
  });
});
