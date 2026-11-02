import type { MenuLayout } from '@irdashies/types';

const without = <T>(list: T[] | undefined, value: T) =>
  (list ?? []).filter((v) => v !== value);

/** Group a widget shows in: its assigned one while that group still exists. */
export const groupOf = (
  widgetType: string,
  defaultGroup: string,
  layout: MenuLayout | undefined,
  builtInIds: readonly string[]
) => {
  const assigned = layout?.assign?.[widgetType];
  const exists =
    assigned &&
    (builtInIds.includes(assigned) ||
      layout?.groups?.some((g) => g.id === assigned));
  return exists ? assigned : defaultGroup;
};

export const moveWidget = (
  layout: MenuLayout | undefined,
  widgetType: string,
  groupId: string,
  defaultGroup: string
): MenuLayout => {
  const rest = Object.fromEntries(
    Object.entries(layout?.assign ?? {}).filter(([type]) => type !== widgetType)
  );
  // A widget dropped into a collapsed group would vanish, so open it.
  return {
    ...layout,
    collapsed: without(layout?.collapsed, groupId),
    assign:
      groupId === defaultGroup ? rest : { ...rest, [widgetType]: groupId },
  };
};

export const addGroup = (
  layout: MenuLayout | undefined,
  label: string
): MenuLayout => ({
  ...layout,
  groups: [
    ...(layout?.groups ?? []),
    { id: `custom-${Date.now().toString(36)}`, label: label.trim() },
  ],
});

/** Widgets in a removed group fall back to their default group. */
export const removeGroup = (
  layout: MenuLayout | undefined,
  id: string
): MenuLayout => ({
  ...layout,
  groups: (layout?.groups ?? []).filter((g) => g.id !== id),
  assign: Object.fromEntries(
    Object.entries(layout?.assign ?? {}).filter(([, g]) => g !== id)
  ),
  collapsed: without(layout?.collapsed, id),
});

export const toggleCollapsed = (
  layout: MenuLayout | undefined,
  id: string
): MenuLayout => ({
  ...layout,
  collapsed: layout?.collapsed?.includes(id)
    ? without(layout.collapsed, id)
    : [...(layout?.collapsed ?? []), id],
});
