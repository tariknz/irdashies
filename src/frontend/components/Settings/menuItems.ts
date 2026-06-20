import {
  SlidersHorizontalIcon,
  UsersIcon,
  TagIcon,
  ScalesIcon,
  KeyboardIcon,
  WrenchIcon,
  InfoIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

export interface MenuItem {
  to: string;
  path: string;
  label: string;
  widgetType?: string;
  icon?: Icon;
}

export const generalItems: MenuItem[] = [
  {
    to: '/settings/general',
    path: '/general',
    label: 'General',
    icon: SlidersHorizontalIcon,
  },
  {
    to: '/settings/profiles',
    path: '/profiles',
    label: 'Profiles',
    icon: UsersIcon,
  },
  {
    to: '/settings/keybindings',
    path: '/keybindings',
    label: 'Key Bindings',
    icon: KeyboardIcon,
  },
  {
    to: '/settings/driver-tags',
    path: '/driver-tags',
    label: 'Driver Tags',
    icon: TagIcon,
  },
  {
    to: '/settings/car-setup',
    path: '/car-setup',
    label: 'Setup Comparison',
    icon: ScalesIcon,
  },
];

export const widgetItems: MenuItem[] = [
  {
    to: '/settings/blindspotmonitor',
    path: '/blindspotmonitor',
    label: 'Blind Spot Monitor',
    widgetType: 'blindspotmonitor',
  },
  {
    to: '/settings/cornername',
    path: '/cornername',
    label: 'Corner Names',
    widgetType: 'cornername',
  },
  {
    to: '/settings/fastercarsfrombehind',
    path: '/fastercarsfrombehind',
    label: 'Faster Cars Behind',
    widgetType: 'fastercarsfrombehind',
  },
  { to: '/settings/flag', path: '/flag', label: 'Flag', widgetType: 'flag' },
  {
    to: '/settings/flatmap',
    path: '/flatmap',
    label: 'Flat Track Map',
    widgetType: 'flatmap',
  },
  {
    to: '/settings/fuel',
    path: '/fuel',
    label: 'Fuel Calculator',
    widgetType: 'fuel',
  },
  {
    to: '/settings/garagecover',
    path: '/garagecover',
    label: 'Garage Cover',
    widgetType: 'garagecover',
  },
  {
    to: '/settings/heartrate',
    path: '/heartrate',
    label: 'Heart Rate',
    widgetType: 'heartrate',
  },
  {
    to: '/settings/infobar',
    path: '/infobar',
    label: 'Information Bar',
    widgetType: 'infobar',
  },
  {
    to: '/settings/input',
    path: '/input',
    label: 'Input',
    widgetType: 'input',
  },
  {
    to: '/settings/laptimelog',
    path: '/laptimelog',
    label: 'Lap Timer',
    widgetType: 'laptimelog',
  },
  {
    to: '/settings/pitlanehelper',
    path: '/pitlanehelper',
    label: 'Pitlane Helper',
    widgetType: 'pitlanehelper',
  },
  {
    to: '/settings/rejoin',
    path: '/rejoin',
    label: 'Rejoin Indicator',
    widgetType: 'rejoin',
  },
  {
    to: '/settings/relative',
    path: '/relative',
    label: 'Relative',
    widgetType: 'relative',
  },
  {
    to: '/settings/sectordelta',
    path: '/sectordelta',
    label: 'Sector Delta',
    widgetType: 'sectordelta',
  },
  {
    to: '/settings/slowcarahead',
    path: '/slowcarahead',
    label: 'Slow Car Ahead',
    widgetType: 'slowcarahead',
  },
  {
    to: '/settings/standings',
    path: '/standings',
    label: 'Standings',
    widgetType: 'standings',
  },
  {
    to: '/settings/tachometer',
    path: '/tachometer',
    label: 'Tachometer',
    widgetType: 'tachometer',
  },
  { to: '/settings/map', path: '/map', label: 'Track Map', widgetType: 'map' },
  {
    to: '/settings/twitchchat',
    path: '/twitchchat',
    label: 'Twitch Chat',
    widgetType: 'twitchchat',
  },
  {
    to: '/settings/weather',
    path: '/weather',
    label: 'Weather',
    widgetType: 'weather',
  },
  {
    to: '/settings/wind',
    path: '/wind',
    label: 'Wind',
    widgetType: 'wind',
  },
];

export const bottomItems: MenuItem[] = [
  {
    to: '/settings/advanced',
    path: '/advanced',
    label: 'Advanced',
    icon: WrenchIcon,
  },
  { to: '/settings/about', path: '/about', label: 'About', icon: InfoIcon },
];

/**
 * Friendly label for a widget given its type (falls back to the raw type when
 * the widget isn't in the settings menu).
 */
export function widgetLabel(widgetType: string): string {
  return (
    widgetItems.find((item) => item.widgetType === widgetType)?.label ??
    widgetType
  );
}
