import {
  SlidersHorizontalIcon,
  UsersIcon,
  TagIcon,
  ScalesIcon,
  KeyboardIcon,
  WrenchIcon,
  InfoIcon,
  NewspaperIcon,
  ArrowClockwiseIcon,
  FlagCheckeredIcon,
  GearSixIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { WIDGET_MANIFESTS } from '@irdashies/types';
import type { WidgetCategory } from '@irdashies/types';
import { compareMenuLabels } from './menuLabelOrder';

export interface MenuItem {
  to: string;
  path: string;
  label: string;
  widgetType?: string;
  category?: WidgetCategory;
  icon?: Icon;
  hideInMenu?: boolean;
}

export const BROADCAST_SETTINGS_PAGE = '/settings/broadcast-settings';

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
  {
    to: BROADCAST_SETTINGS_PAGE,
    path: '/broadcast-settings',
    label: 'Broadcast Settings',
    icon: GearSixIcon,
  },
];

export const toolItems: MenuItem[] = [
  {
    to: '/settings/profiles',
    path: '/profiles',
    label: 'Profiles',
    icon: UsersIcon,
  },
  {
    to: '/settings/driver-tags',
    path: '/driver-tags',
    label: 'Driver Tags',
    icon: TagIcon,
  },
  {
    to: '/settings/race-plan',
    path: '/race-plan',
    label: 'Race Plan',
    icon: FlagCheckeredIcon,
  },
  {
    to: '/settings/car-setup',
    path: '/car-setup',
    label: 'Setup Comparison',
    icon: ScalesIcon,
  },
];

export const widgetItems: MenuItem[] = WIDGET_MANIFESTS.map(
  ({ id, name, menuLabel, category, hideInMenu }) => ({
    to: `/settings/${id}`,
    path: `/${id}`,
    label: menuLabel ?? name,
    widgetType: id,
    category,
    ...(hideInMenu && { hideInMenu }),
  })
).sort((a, b) => compareMenuLabels(a.label, b.label));

/**
 * Whether the widget has a switch in the overlay list. Its settings page
 * omits its own switch when the menu provides one.
 */
export const menuHasToggle = (
  widgetType: string,
  dashboardWidgetIds: readonly string[]
): boolean =>
  dashboardWidgetIds.includes(widgetType) &&
  widgetItems.some(
    (item) => item.widgetType === widgetType && !item.hideInMenu
  );

export const bottomItems: MenuItem[] = [
  {
    to: '/settings/advanced',
    path: '/advanced',
    label: 'Advanced',
    icon: WrenchIcon,
  },
  {
    to: '/settings/updates',
    path: '/updates',
    label: 'Updates',
    icon: ArrowClockwiseIcon,
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
