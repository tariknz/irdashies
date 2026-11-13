import { bottomItems, generalItems, toolItems } from './menuItems';

/**
 * Which kind of settings page a path is: an App settings page, a tool page
 * (Profiles, Driver Tags, Setup Comparison), or anything else, an overlay's.
 * The layout and the menu both ask, and must agree.
 */
export type SettingsPageKind = 'app' | 'tool' | 'overlay';

export const settingsPageKind = (pathname: string): SettingsPageKind => {
  if ([...generalItems, ...bottomItems].some((item) => item.to === pathname))
    return 'app';
  if (toolItems.some((item) => item.to === pathname)) return 'tool';
  return 'overlay';
};
