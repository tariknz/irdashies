import { useMemo } from 'react';
import {
  fitLayoutToDisplay,
  isLayoutOnDisplay,
  isWidgetDisabledForSim,
  type DashboardWidget,
} from '@irdashies/types';
import { useDashboard } from '../DashboardContext/DashboardContext';
import { useActiveSimulator } from './useActiveSimulator';
import { useSimWidgetSupport } from './useSimWidgetSupport';

/**
 * Widget types that are rendered by a window of their own rather than by the
 * overlay (see the hash routes in App.tsx). They still live in the dashboard
 * and still subscribe to data, so only the overlay's renderer excludes them.
 */
const OWN_WINDOW_WIDGET_TYPES = new Set(['gantry']);

/** Shown only docked in the Gantry, never on an overlay or browser source. */
export const isGantryOnly = (widget: DashboardWidget): boolean =>
  widget.placement === 'gantry';

/** Does this widget render in its own window instead of the overlay? */
export const rendersInOwnWindow = (widget: DashboardWidget): boolean =>
  OWN_WINDOW_WIDGET_TYPES.has(widget.type || widget.id) || isGantryOnly(widget);

/**
 * The enabled widgets this overlay window is responsible for.
 *
 * With one window per display, a widget belongs to the window whose display
 * contains its centre. A widget that lands on no display at all renders on the
 * primary, moved inside it, so a layout saved against a monitor that has
 * since been unplugged or switched off is still visible.
 *
 * Shared because three callers need the same answer and must agree on it: the
 * container that renders the widgets, the data providers that subscribe on
 * their behalf, and the lap-trace recorder, which writes to disk and would
 * duplicate its work if every window ran one.
 *
 * A widget the running sim cannot support counts as switched off here, the
 * same as it does when main decides which windows to build. Window creation
 * alone is not enough: one window can span several widgets, so an unsupported
 * widget sitting between two supported ones is inside a window that was built
 * anyway, and would render and subscribe unless it is dropped here too.
 *
 * `browser` skips the display filtering — a browser-source view has no display
 * bounds of its own and should show the lot — but not the compatibility
 * filtering, which is about the sim rather than the screen.
 */
export const useWidgetsForThisDisplay = (
  browser = false
): DashboardWidget[] => {
  const { currentDashboard, containerBoundsInfo } = useDashboard();
  const simulator = useActiveSimulator();
  const simWidgetSupport = useSimWidgetSupport();

  return useMemo(() => {
    const enabled =
      currentDashboard?.widgets.filter(
        (widget) =>
          widget.enabled &&
          !isGantryOnly(widget) &&
          !isWidgetDisabledForSim(
            simWidgetSupport,
            widget.type ?? widget.id,
            simulator
          )
      ) ?? [];
    if (browser || !containerBoundsInfo?.displayId) return enabled;

    const displayBounds =
      containerBoundsInfo.displayBounds ?? containerBoundsInfo.expected;
    return enabled.flatMap((widget) => {
      if (isLayoutOnDisplay(widget.layout, displayBounds)) return [widget];
      const onAnyDisplay =
        containerBoundsInfo.allDisplayBounds?.some((bounds) =>
          isLayoutOnDisplay(widget.layout, bounds)
        ) ?? false;
      if (onAnyDisplay || !containerBoundsInfo.isPrimary) return [];
      return [
        { ...widget, layout: fitLayoutToDisplay(widget.layout, displayBounds) },
      ];
    });
  }, [
    browser,
    containerBoundsInfo,
    currentDashboard?.widgets,
    simWidgetSupport,
    simulator,
  ]);
};
