import { useMemo } from 'react';
import type { DashboardWidget } from '@irdashies/types';
import { useDashboard } from '../DashboardContext/DashboardContext';

/** Does the widget's centre point fall inside these bounds? */
const isWidgetOnDisplay = (
  widget: DashboardWidget,
  bounds: { x: number; y: number; width: number; height: number }
) => {
  const centerX = widget.layout.x + widget.layout.width / 2;
  const centerY = widget.layout.y + widget.layout.height / 2;
  return (
    centerX >= bounds.x &&
    centerX < bounds.x + bounds.width &&
    centerY >= bounds.y &&
    centerY < bounds.y + bounds.height
  );
};

/**
 * Widget types that are rendered by a window of their own rather than by the
 * overlay (see the hash routes in App.tsx). They still live in the dashboard
 * and still subscribe to data, so only the overlay's renderer excludes them.
 */
const OWN_WINDOW_WIDGET_TYPES = new Set(['gantry']);

/** Does this widget render in its own window instead of the overlay? */
export const rendersInOwnWindow = (widget: DashboardWidget): boolean =>
  OWN_WINDOW_WIDGET_TYPES.has(widget.type || widget.id);

/**
 * The enabled widgets this overlay window is responsible for.
 *
 * With one window per display, a widget belongs to the window whose display
 * contains its centre. A widget that lands on no display at all renders on the
 * primary, so a layout saved against a monitor that has since been unplugged
 * is still reachable rather than invisible.
 *
 * Shared because three callers need the same answer and must agree on it: the
 * container that renders the widgets, the data providers that subscribe on
 * their behalf, and the lap-trace recorder, which writes to disk and would
 * duplicate its work if every window ran one.
 *
 * `browser` skips the filtering entirely — a browser-source view has no
 * display bounds of its own and should show the lot.
 */
export const useWidgetsForThisDisplay = (
  browser = false
): DashboardWidget[] => {
  const { currentDashboard, containerBoundsInfo } = useDashboard();

  return useMemo(() => {
    const enabled =
      currentDashboard?.widgets.filter((widget) => widget.enabled) ?? [];
    if (browser || !containerBoundsInfo?.displayId) return enabled;

    return enabled.filter((widget) => {
      const displayBounds =
        containerBoundsInfo.displayBounds ?? containerBoundsInfo.expected;
      const onThisDisplay = isWidgetOnDisplay(widget, displayBounds);
      const onAnyDisplay =
        containerBoundsInfo.allDisplayBounds?.some((bounds) =>
          isWidgetOnDisplay(widget, bounds)
        ) ?? onThisDisplay;
      return onThisDisplay || (containerBoundsInfo.isPrimary && !onAnyDisplay);
    });
  }, [browser, containerBoundsInfo, currentDashboard?.widgets]);
};
