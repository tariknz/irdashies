import { describe, it, expect } from 'vitest';
import {
  WIDGET_TOGGLE_PREFIX,
  isWidgetToggleActionId,
  isValidWidgetToggleActionId,
  widgetToggleActionId,
  widgetIdFromToggleActionId,
  nextProfileIndex,
} from './keybindingActions';

describe('widget toggle action id helpers', () => {
  it('builds a toggle action id from a widget id', () => {
    expect(widgetToggleActionId('standings')).toBe('toggle-widget:standings');
    expect(widgetToggleActionId('standings')).toBe(
      `${WIDGET_TOGGLE_PREFIX}standings`
    );
  });

  it('detects widget toggle action ids vs static actions', () => {
    expect(isWidgetToggleActionId('toggle-widget:fuel')).toBe(true);
    expect(isWidgetToggleActionId('toggle-hide-ui')).toBe(false);
    expect(isWidgetToggleActionId('save-telemetry')).toBe(false);
  });

  it('round-trips a widget id through build/extract', () => {
    const id = widgetToggleActionId('relative-2');
    expect(widgetIdFromToggleActionId(id)).toBe('relative-2');
  });

  it('extracts ids containing characters beyond the prefix', () => {
    expect(widgetIdFromToggleActionId('toggle-widget:my:weird:id')).toBe(
      'my:weird:id'
    );
  });

  it('treats a prefix with an empty widget id as invalid', () => {
    expect(isValidWidgetToggleActionId('toggle-widget:fuel')).toBe(true);
    expect(isValidWidgetToggleActionId('toggle-widget:')).toBe(false);
    expect(isValidWidgetToggleActionId('toggle-hide-ui')).toBe(false);
  });
});

describe('nextProfileIndex', () => {
  it('advances and goes back without wrapping when loop is off', () => {
    expect(nextProfileIndex(0, 3, 1, false)).toBe(1);
    expect(nextProfileIndex(1, 3, -1, false)).toBe(0);
  });

  it('returns -1 at the edges when loop is off', () => {
    expect(nextProfileIndex(2, 3, 1, false)).toBe(-1); // last -> next
    expect(nextProfileIndex(0, 3, -1, false)).toBe(-1); // first -> prev
  });

  it('wraps around at the edges when loop is on', () => {
    expect(nextProfileIndex(2, 3, 1, true)).toBe(0); // last -> first
    expect(nextProfileIndex(0, 3, -1, true)).toBe(2); // first -> last
  });

  it('treats an unknown current index as the start', () => {
    expect(nextProfileIndex(-1, 3, 1, false)).toBe(1);
  });
});
