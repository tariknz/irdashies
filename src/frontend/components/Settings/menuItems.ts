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
import { WIDGET_MANIFESTS } from '@irdashies/types';

export interface MenuItem {
  to: string;
  path: string;
  label: string;
  widgetType?: string;
  /** Widgets that share this item's page; it shows On while any of them is. */
  groupTypes?: string[];
  icon?: Icon;
  /** Reached through a tab on another item's page rather than the menu. */
  hideInMenu?: boolean;
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

export const widgetItems: MenuItem[] = WIDGET_MANIFESTS.map(
  ({ id, name, menuLabel, hideInMenu, groupTypes }) => ({
    to: `/settings/${id}`,
    path: `/${id}`,
    label: menuLabel ?? name,
    widgetType: id,
    ...(groupTypes && { groupTypes }),
    ...(hideInMenu && { hideInMenu }),
  })
).sort((a, b) => a.label.localeCompare(b.label));

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
