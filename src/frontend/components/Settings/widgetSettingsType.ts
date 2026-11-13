/**
 * The widget type whose settings page a page id shows: a widget in the
 * layout gives its type (a layout copy, its original's), any other id is
 * taken as a type itself. Shared by the settings loader, which picks the page,
 * and the layout, which decides what to reopen, so the two cannot drift.
 */
export const widgetSettingsType = (
  widgets: readonly { id: string; type?: string }[] | undefined,
  id: string
): string => {
  const widget = widgets?.find((w) => w.id === id);
  return widget ? widget.type || widget.id : id;
};
