/** The settings page irDashies opens on when there is no widget page to restore. */
export const DEFAULT_WIDGET_PAGE = '/settings/relative';

/** Kept in the settings window's local storage, so it survives a restart. */
const STORAGE_KEY = 'settingsLastWidgetPage';

/** The widget settings page open last, if one was saved. */
export const readLastWidgetPage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const saveLastWidgetPage = (path: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Storage unavailable: the next start opens on the default page.
  }
};

/**
 * The page to open on: the widget page left last, while that widget still
 * has a page, else Relative. A widget can be gone by the next start: removed
 * from the layout, a copy missing from the profile now active, or a type a
 * newer version dropped.
 */
export const startWidgetPage = (
  stored: string | null,
  isWidgetPage: (id: string) => boolean
): string => {
  const id = stored?.match(/^\/settings\/([^/]+)$/)?.[1];
  return stored && id && isWidgetPage(id) ? stored : DEFAULT_WIDGET_PAGE;
};
