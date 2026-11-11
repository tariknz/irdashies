import type { MenuItem } from './menuItems';

/** How the overlay list in the settings menu is ordered. */
export type MenuSortMode = 'category' | 'alpha' | 'activated';

/** In the order a click on the sort button steps through them. */
export const MENU_SORT_MODES: readonly MenuSortMode[] = [
  'category',
  'alpha',
  'activated',
];

export const MENU_SORT_LABELS: Record<MenuSortMode, string> = {
  category: 'By category',
  alpha: 'Alphabetical',
  activated: 'Activated first',
};

export const DEFAULT_MENU_SORT: MenuSortMode = 'category';

/** Kept in the settings window's local storage, so it survives a restart. */
const STORAGE_KEY = 'settingsMenuSort';

const isMenuSortMode = (value: unknown): value is MenuSortMode =>
  MENU_SORT_MODES.includes(value as MenuSortMode);

/** The order last chosen, or by category when none was or it is unknown. */
export const readMenuSort = (): MenuSortMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMenuSortMode(stored) ? stored : DEFAULT_MENU_SORT;
  } catch {
    return DEFAULT_MENU_SORT;
  }
};

export const saveMenuSort = (mode: MenuSortMode): void => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable: the order holds for this session only.
  }
};

/** The order after `mode`, back to the first after the last. */
export const nextMenuSort = (mode: MenuSortMode): MenuSortMode =>
  MENU_SORT_MODES[(MENU_SORT_MODES.indexOf(mode) + 1) % MENU_SORT_MODES.length];

/** Alphanumeric, ignoring case, so "Lap Timer 2" comes before "Lap Timer 10". */
const byLabel = (a: MenuItem, b: MenuItem) =>
  a.label.localeCompare(b.label, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

/**
 * The items as one list, for the orders without categories: alphanumeric, or
 * the activated ones first and then the rest, each part alphanumeric.
 */
export const sortMenuItems = (
  items: readonly MenuItem[],
  mode: Exclude<MenuSortMode, 'category'>,
  isActivated: (item: MenuItem) => boolean
): MenuItem[] => {
  const sorted = [...items].sort(byLabel);
  if (mode === 'alpha') return sorted;
  return [
    ...sorted.filter(isActivated),
    ...sorted.filter((item) => !isActivated(item)),
  ];
};
