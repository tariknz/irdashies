import {
  SlidersHorizontalIcon,
  UsersIcon,
  TagIcon,
  ScalesIcon,
  KeyboardIcon,
  WrenchIcon,
  InfoIcon,
  NewspaperIcon,
  FlagCheckeredIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { WIDGET_MANIFESTS } from '@irdashies/types';
import type { WidgetCategory } from '@irdashies/types';

export interface MenuItem {
  to: string;
  path: string;
  label: string;
  widgetType?: string;
  category?: WidgetCategory | 'Tools';
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
    to: '/settings/keybindings',
    path: '/keybindings',
    label: 'Key Bindings',
    icon: KeyboardIcon,
  },
];

export const toolItems: MenuItem[] = [
  {
    to: '/settings/profiles',
    path: '/profiles',
    label: 'Profiles',
    icon: UsersIcon,
    category: 'Tools',
  },
  {
    to: '/settings/driver-tags',
    path: '/driver-tags',
    label: 'Driver Tags',
    icon: TagIcon,
    category: 'Tools',
  },
  {
    to: '/settings/race-plan',
    path: '/race-plan',
    label: 'Race Plan',
    icon: FlagCheckeredIcon,
    category: 'Tools',
  },
  {
    to: '/settings/car-setup',
    path: '/car-setup',
    label: 'Setup Comparison',
    icon: ScalesIcon,
    category: 'Tools',
  },
];

export const widgetItems: MenuItem[] = WIDGET_MANIFESTS.map(
  ({ id, name, menuLabel, category, hideInMenu, groupTypes }) => ({
    to: `/settings/${id}`,
    path: `/${id}`,
    label: menuLabel ?? name,
    widgetType: id,
    category,
    ...(groupTypes && { groupTypes }),
    ...(hideInMenu && { hideInMenu }),
  })
).sort((a, b) => a.label.localeCompare(b.label));

/**
 * Whether the settings menu offers a switch for this widget: it is listed
 * there on its own and exists in the dashboard. The widget's page leaves its
 * own switch out then, so there is one place to flip it.
 */
export const menuHasToggle = (
  widgetType: string,
  dashboardWidgetIds: readonly string[]
): boolean =>
  dashboardWidgetIds.includes(widgetType) &&
  widgetItems.some(
    (item) =>
      item.widgetType === widgetType && !item.hideInMenu && !item.groupTypes
  );

export const bottomItems: MenuItem[] = [
  {
    to: '/settings/advanced',
    path: '/advanced',
    label: 'Advanced',
    icon: WrenchIcon,
  },
  {
    to: '/settings/release-notes',
    path: '/release-notes',
    label: 'Release notes',
    icon: NewspaperIcon,
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
