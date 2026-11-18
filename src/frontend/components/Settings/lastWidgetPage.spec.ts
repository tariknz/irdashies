import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDGET_PAGE,
  existingWidgetPage,
  readLastWidgetPage,
  saveLastWidgetPage,
  startWidgetPage,
} from './lastWidgetPage';

const known = new Set(['standings', 'standings-review']);
const isWidgetPage = (id: string) => known.has(id);

describe('last widget page', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the page saved last', () => {
    expect(readLastWidgetPage()).toBeNull();
    saveLastWidgetPage('/settings/standings');
    expect(readLastWidgetPage()).toBe('/settings/standings');
  });

  it('starts on the page left last while its widget still has a page', () => {
    expect(startWidgetPage('/settings/standings', isWidgetPage)).toBe(
      '/settings/standings'
    );
    // A layout copy's own page.
    expect(startWidgetPage('/settings/standings-review', isWidgetPage)).toBe(
      '/settings/standings-review'
    );
  });

  it('starts on Relative when nothing was saved or the widget is gone', () => {
    expect(DEFAULT_WIDGET_PAGE).toBe('/settings/relative');
    expect(startWidgetPage(null, isWidgetPage)).toBe(DEFAULT_WIDGET_PAGE);
    expect(startWidgetPage('/settings/removed', isWidgetPage)).toBe(
      DEFAULT_WIDGET_PAGE
    );
  });

  it('keeps a path only while its widget page exists', () => {
    expect(existingWidgetPage('/settings/standings', isWidgetPage)).toBe(
      '/settings/standings'
    );
    expect(
      existingWidgetPage('/settings/removed', isWidgetPage)
    ).toBeUndefined();
    expect(existingWidgetPage(null, isWidgetPage)).toBeUndefined();
    expect(existingWidgetPage(undefined, isWidgetPage)).toBeUndefined();
  });

  it('ignores anything that is not a settings page', () => {
    for (const stored of ['', '/settings', '/settings/', '/other/standings']) {
      expect(startWidgetPage(stored, isWidgetPage)).toBe(DEFAULT_WIDGET_PAGE);
    }
    expect(startWidgetPage('/settings/standings/extra', isWidgetPage)).toBe(
      DEFAULT_WIDGET_PAGE
    );
  });
});
