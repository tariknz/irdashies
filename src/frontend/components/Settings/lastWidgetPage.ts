import { readLocalSetting, writeLocalSetting } from './localSetting';

/** The settings page irDashies opens on when there is no widget page to restore. */
export const DEFAULT_WIDGET_PAGE = '/settings/relative';

/** Kept in the settings window's local storage, so it survives a restart. */
const STORAGE_KEY = 'settingsLastWidgetPage';

/** The widget settings page open last, if one was saved. */
export const readLastWidgetPage = (): string | null =>
  readLocalSetting(STORAGE_KEY);

export const saveLastWidgetPage = (path: string): void =>
  writeLocalSetting(STORAGE_KEY, path);

/**
 * `path` while it is a widget page that still exists, else undefined. A
 * widget can be gone since the path was taken: removed from the layout, a
 * copy missing from the profile now active, or a type a newer version
 * dropped.
 */
export const existingWidgetPage = (
  path: string | null | undefined,
  isWidgetPage: (id: string) => boolean
): string | undefined => {
  const id = path?.match(/^\/settings\/([^/]+)$/)?.[1];
  return path && id && isWidgetPage(id) ? path : undefined;
};

/** The page to open on: the widget page left last, if it still exists, else Relative. */
export const startWidgetPage = (
  stored: string | null,
  isWidgetPage: (id: string) => boolean
): string => existingWidgetPage(stored, isWidgetPage) ?? DEFAULT_WIDGET_PAGE;
