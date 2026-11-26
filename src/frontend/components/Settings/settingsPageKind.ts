import { bottomItems, generalItems, toolItems } from './menuItems';

export type SettingsPageKind = 'app' | 'tool' | 'overlay';

export const settingsPageKind = (pathname: string): SettingsPageKind => {
  if ([...generalItems, ...bottomItems].some((item) => item.to === pathname))
    return 'app';
  if (toolItems.some((item) => item.to === pathname)) return 'tool';
  return 'overlay';
};
