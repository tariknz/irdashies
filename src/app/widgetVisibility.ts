import logger from './logger';

/**
 * Widgets hidden for this session by their per-widget hotkey. Kept here
 * rather than in KeybindingManager so the web server can tell browser views
 * (the OBS dashboard page) too, not just the overlay windows.
 */
const hidden = new Set<string>();
const listeners = new Set<(widgetId: string, hide: boolean) => void>();

/** Flips a widget's hidden state and returns the new one. */
export const toggleWidgetHidden = (widgetId: string): boolean => {
  const hide = !hidden.has(widgetId);
  if (hide) hidden.add(widgetId);
  else hidden.delete(widgetId);
  listeners.forEach((cb) => {
    try {
      cb(widgetId, hide);
    } catch (err) {
      logger.error('[widgetVisibility] listener failed:', err);
    }
  });
  return hide;
};

export const getHiddenWidgets = (): string[] => [...hidden];

export const onWidgetHiddenChanged = (
  cb: (widgetId: string, hide: boolean) => void
) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
