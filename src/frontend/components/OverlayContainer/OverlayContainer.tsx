import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useDashboard,
  useRunningState,
  useResetOnDisconnect,
} from '@irdashies/context';
import type { WidgetLayout } from '@irdashies/types';
import { WidgetContainer } from '../WidgetContainer';
import { getWidget } from '../../WidgetIndex';
import { XIcon } from '@phosphor-icons/react';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import { SectorTimingUpdater } from './SectorTimingUpdater';
import { PushToPassUpdater } from './PushToPassUpdater';

export const OverlayContainer = memo(() => {
  const {
    currentDashboard,
    editMode,
    onDashboardUpdated,
    bridge,
    containerBoundsInfo,
  } = useDashboard();
  const { running } = useRunningState();
  useResetOnDisconnect(running);

  // Session-only per-widget visibility, toggled via a hotkey in the main
  // process (see KeybindingManager.toggleWidgetHide). Does not touch the saved
  // dashboard — purely transient, mirroring the global Alt+H hide.
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<Set<string>>(
    () => new Set()
  );
  useEffect(() => {
    if (!window.globalKey?.onWidgetToggle) return;
    return window.globalKey.onWidgetToggle((widgetId, hide) => {
      setHiddenWidgetIds((prev) => {
        const next = new Set(prev);
        if (hide) {
          next.add(widgetId);
        } else {
          next.delete(widgetId);
        }
        return next;
      });
    });
  }, []);

  const handleExitEditMode = useCallback(() => {
    bridge.toggleLockOverlays();
  }, [bridge]);

  // Use refs so handleLayoutChange is stable and doesn't cause all
  // WidgetContainers to re-render when any single widget is moved
  const dashboardRef = useRef(currentDashboard);
  const onDashboardUpdatedRef = useRef(onDashboardUpdated);
  useEffect(() => {
    dashboardRef.current = currentDashboard;
  }, [currentDashboard]);
  useEffect(() => {
    onDashboardUpdatedRef.current = onDashboardUpdated;
  }, [onDashboardUpdated]);

  const handleDisableWidget = useCallback((widgetId: string) => {
    const dashboard = dashboardRef.current;
    const updateFn = onDashboardUpdatedRef.current;
    if (!dashboard || !updateFn) return;

    const updatedWidgets = dashboard.widgets.map((w) =>
      w.id === widgetId ? { ...w, enabled: false } : w
    );
    updateFn({ ...dashboard, widgets: updatedWidgets });
  }, []);

  const handleOpenWidgetSettings = useCallback(
    (widgetId: string) => {
      const dashboard = dashboardRef.current;
      const widget = dashboard?.widgets.find((w) => w.id === widgetId);
      const widgetType = widget?.type || widgetId;
      bridge.openWidgetSettings?.(widgetType);
    },
    [bridge]
  );

  const handleLayoutChange = useCallback(
    (widgetId: string, layout: WidgetLayout) => {
      const dashboard = dashboardRef.current;
      const updateFn = onDashboardUpdatedRef.current;
      if (!dashboard || !updateFn) return;

      const updatedWidgets = dashboard.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, layout } : widget
      );

      updateFn(
        { ...dashboard, widgets: updatedWidgets },
        { skipWindowRefresh: true }
      );
    },
    []
  );

  const enabledWidgets = useMemo(
    () => currentDashboard?.widgets.filter((widget) => widget.enabled) ?? [],
    [currentDashboard?.widgets]
  );

  // When running per-display windows, each window only renders its own widgets.
  // A widget belongs to a display if its center point falls within that display's bounds.
  // Unmatched widgets (e.g. default positions that fall in no display) render on the primary.
  const widgetsForThisDisplay = useMemo(() => {
    if (!containerBoundsInfo?.displayId) {
      return enabledWidgets;
    }

    return enabledWidgets.filter((widget) => {
      const displayBounds =
        containerBoundsInfo.displayBounds ?? containerBoundsInfo.expected;
      const centerX = widget.layout.x + widget.layout.width / 2;
      const centerY = widget.layout.y + widget.layout.height / 2;
      const inBounds = (b: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) =>
        centerX >= b.x &&
        centerX < b.x + b.width &&
        centerY >= b.y &&
        centerY < b.y + b.height;
      const inThisDisplay = inBounds(displayBounds);
      const inAnyDisplay =
        containerBoundsInfo.allDisplayBounds?.some(inBounds) ?? inThisDisplay;
      return inThisDisplay || (containerBoundsInfo.isPrimary && !inAnyDisplay);
    });
  }, [containerBoundsInfo, enabledWidgets]);

  const siblingLayoutsByWidgetId = useMemo(() => {
    return new Map(
      widgetsForThisDisplay.map((widget) => [
        widget.id,
        widgetsForThisDisplay
          .filter((otherWidget) => otherWidget.id !== widget.id)
          .map((otherWidget) => otherWidget.layout),
      ])
    );
  }, [widgetsForThisDisplay]);

  if (!currentDashboard) {
    return null;
  }

  return (
    <div
      className={[
        'fixed inset-0 overflow-hidden pointer-events-none',
        editMode ? 'bg-blue-900/20' : '',
      ].join(' ')}
    >
      <SectorTimingUpdater />
      <PushToPassUpdater />
      {widgetsForThisDisplay.map((widget, index) => {
        // Transiently hidden via a per-widget hotkey — skip rendering.
        if (hiddenWidgetIds.has(widget.id)) {
          return null;
        }

        const WidgetComponent = getWidget(widget.type || widget.id);
        if (!WidgetComponent) {
          return null;
        }

        return (
          <WidgetContainer
            key={widget.id}
            widget={widget}
            siblingLayouts={siblingLayoutsByWidgetId.get(widget.id)}
            editMode={editMode}
            zIndex={index + 1}
            onLayoutChange={handleLayoutChange}
            onDisable={handleDisableWidget}
            onOpenSettings={handleOpenWidgetSettings}
          >
            {running || widget.alwaysEnabled ? (
              <ErrorBoundary
                label={`widget:${widget.type || widget.id}`}
                resetAfterMs={2000}
              >
                <WidgetComponent {...widget.config} />
              </ErrorBoundary>
            ) : null}
          </WidgetContainer>
        );
      })}

      {/* Exit edit mode button - centered, 50px from top */}
      {editMode && (
        <button
          onClick={handleExitEditMode}
          className="pointer-events-auto fixed top-12.5 left-1/2 -translate-x-1/2 z-9999 flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded shadow-lg transition-colors cursor-pointer"
        >
          <XIcon size={18} weight="bold" />
          <span className="text-sm font-medium">Exit Edit Mode</span>
        </button>
      )}
    </div>
  );
});

OverlayContainer.displayName = 'OverlayContainer';
