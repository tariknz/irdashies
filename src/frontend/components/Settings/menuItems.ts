import {
  SlidersHorizontalIcon,
  UsersIcon,
  TagIcon,
  ScalesIcon,
  KeyboardIcon,
  WrenchIcon,
  InfoIcon,
  NewspaperIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { WIDGET_MANIFESTS, type WidgetId } from '@irdashies/types';

/** Menu groups, in display order. */
export const WIDGET_CATEGORIES = [
  { id: 'race', label: 'Timing & Race' },
  { id: 'car', label: 'Car & Driver' },
  { id: 'awareness', label: 'Awareness' },
  { id: 'track', label: 'Track & Conditions' },
  { id: 'extras', label: 'Extras' },
] as const;
export type WidgetCategory = (typeof WIDGET_CATEGORIES)[number]['id'];

export interface MenuItem {
  to: string;
  path: string;
  label: string;
  widgetType?: string;
  /** Widgets that share this item's page; it shows On while any of them is. */
  groupTypes?: string[];
  category?: WidgetCategory;
  /** One line under the label in the settings menu. */
  description?: string;
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

/** Menu group and one-line summary per widget; the manifests carry neither. */
const WIDGET_MENU_META: Partial<
  Record<WidgetId, { category: WidgetCategory; description: string }>
> = {
  broadcast: {
    category: 'extras',
    description: 'TV-style overlay for streams',
  },
  battle: { category: 'race', description: 'Gaps to cars ahead and behind' },
  blindspotmonitor: {
    category: 'awareness',
    description: 'Cars alongside, left and right',
  },
  cornername: { category: 'track', description: 'Current corner and section' },
  carsystems: {
    category: 'car',
    description: 'Brake bias, ABS, traction control',
  },
  deltaspeed: { category: 'race', description: 'Speed versus your best lap' },
  fastercarsfrombehind: {
    category: 'awareness',
    description: 'Faster classes closing in',
  },
  flag: { category: 'awareness', description: 'Track flags' },
  flatmap: { category: 'track', description: 'Straight-line track map' },
  fuel: { category: 'car', description: 'Burn rate, laps left, pit fuel' },
  gantry: { category: 'race', description: 'Race control window' },
  garagecover: {
    category: 'extras',
    description: 'Covers the screen in the garage',
  },
  heartrate: { category: 'car', description: 'Live heart rate via HypeRate' },
  infobar: { category: 'race', description: 'Session and timing bar' },
  input: { category: 'car', description: 'Throttle, brake and clutch traces' },
  laptimelog: { category: 'race', description: 'Lap time history' },
  laptrace: {
    category: 'car',
    description: 'Saved lap inputs along the track',
  },
  pitlanehelper: {
    category: 'awareness',
    description: 'Pit entry speed and pitbox',
  },
  radar: { category: 'awareness', description: 'Top-down view of nearby cars' },
  rejoin: { category: 'awareness', description: 'Safe-to-rejoin indicator' },
  relative: { category: 'race', description: 'Cars ahead and behind' },
  sectordelta: { category: 'race', description: 'Per-sector time deltas' },
  shiftlight: { category: 'car', description: 'Shift point lights' },
  slowcarahead: {
    category: 'awareness',
    description: 'Slow cars ahead warning',
  },
  standings: { category: 'race', description: 'Class positions' },
  tachometer: { category: 'car', description: 'RPM and shift lights' },
  map: { category: 'track', description: 'Circuit map with cars' },
  twitchchat: { category: 'extras', description: 'Twitch chat feed' },
  weather: { category: 'track', description: 'Temperatures, wind, wetness' },
  wind: { category: 'track', description: 'Wind direction and speed' },
};

export const widgetItems: MenuItem[] = WIDGET_MANIFESTS.map(
  ({ id, name, menuLabel, hideInMenu, groupTypes }) => ({
    to: `/settings/${id}`,
    path: `/${id}`,
    label: menuLabel ?? name,
    widgetType: id,
    ...WIDGET_MENU_META[id],
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
