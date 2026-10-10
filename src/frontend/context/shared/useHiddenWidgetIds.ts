import { useEffect, useState } from 'react';

/**
 * Widgets hidden for this session by their hotkey (see the main process
 * KeybindingManager). Transient: the saved dashboard is not touched.
 */
export const useHiddenWidgetIds = (): ReadonlySet<string> => {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!window.globalKey?.onWidgetToggle) return;
    return window.globalKey.onWidgetToggle((widgetId, hide) =>
      setHidden((prev) => {
        if (prev.has(widgetId) === hide) return prev;
        const next = new Set(prev);
        if (hide) next.add(widgetId);
        else next.delete(widgetId);
        return next;
      })
    );
  }, []);
  return hidden;
};
