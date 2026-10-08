import { readData, writeData } from './storage';

const SHOW_ALL_WIDGETS_KEY = 'settingsShowAllWidgets';

/**
 * Whether the settings menu lists every widget, or only the ones the running
 * simulator supports.
 *
 * Stored in config.json rather than with the dashboard: it is a preference
 * about the settings window itself, not part of a layout, so it should not
 * change when the user switches profile.
 *
 * Defaults to false — only compatible widgets.
 */
export const getSettingsShowAllWidgets = (): boolean =>
  readData<boolean>(SHOW_ALL_WIDGETS_KEY) ?? false;

export const setSettingsShowAllWidgets = (showAll: boolean): void => {
  writeData(SHOW_ALL_WIDGETS_KEY, showAll);
};
