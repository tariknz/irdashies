import { useMemo } from 'react';
import {
  PitLaneProvider,
  ReferenceStoreProvider,
  SessionProvider,
  TelemetryProvider,
  useDashboard,
} from '@irdashies/context';
import { rendererNeedsLegacyTelemetry } from '../../widgetRuntime';

const isWidgetOnDisplay = (
  widget: { layout: { x: number; y: number; width: number; height: number } },
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

export const RendererDataProviders = ({
  browser = false,
}: {
  browser?: boolean;
}) => {
  const { currentDashboard, containerBoundsInfo } = useDashboard();
  const needsLegacyTelemetry = useMemo(() => {
    const enabledWidgets =
      currentDashboard?.widgets.filter((widget) => widget.enabled) ?? [];
    const widgets =
      browser || !containerBoundsInfo?.displayId
        ? enabledWidgets
        : enabledWidgets.filter((widget) => {
            const displayBounds =
              containerBoundsInfo.displayBounds ?? containerBoundsInfo.expected;
            const onThisDisplay = isWidgetOnDisplay(widget, displayBounds);
            const onAnyDisplay =
              containerBoundsInfo.allDisplayBounds?.some((bounds) =>
                isWidgetOnDisplay(widget, bounds)
              ) ?? onThisDisplay;
            return (
              onThisDisplay || (containerBoundsInfo.isPrimary && !onAnyDisplay)
            );
          });
    return rendererNeedsLegacyTelemetry(widgets);
  }, [browser, containerBoundsInfo, currentDashboard?.widgets]);

  if (!needsLegacyTelemetry) return null;

  return (
    <>
      <SessionProvider bridge={window.irsdkBridge} />
      <TelemetryProvider bridge={window.irsdkBridge} />
      {window.pitLaneBridge ? (
        <PitLaneProvider bridge={window.pitLaneBridge} />
      ) : null}
      {window.referenceLapsBridge ? (
        <ReferenceStoreProvider bridge={window.referenceLapsBridge} />
      ) : null}
    </>
  );
};
