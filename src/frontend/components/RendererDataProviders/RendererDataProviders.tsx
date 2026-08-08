import { useMemo } from 'react';
import {
  PitLaneProvider,
  ReferenceStoreProvider,
  SessionProvider,
  TelemetryProvider,
  useDashboard,
} from '@irdashies/context';
import {
  rendererNeedsChannel,
  rendererNeedsLegacyTelemetry,
} from '../../widgetRuntime';

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
  const runtimeNeeds = useMemo(() => {
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
    return {
      legacyTelemetry: rendererNeedsLegacyTelemetry(widgets),
      referenceLaps: rendererNeedsChannel(widgets, 'reference-laps.snapshot'),
    };
  }, [browser, containerBoundsInfo, currentDashboard?.widgets]);

  if (!runtimeNeeds.legacyTelemetry && !runtimeNeeds.referenceLaps) return null;

  return (
    <>
      {runtimeNeeds.legacyTelemetry ? (
        <>
          <SessionProvider bridge={window.irsdkBridge} />
          <TelemetryProvider bridge={window.irsdkBridge} />
        </>
      ) : null}
      {runtimeNeeds.legacyTelemetry && window.pitLaneBridge ? (
        <PitLaneProvider bridge={window.pitLaneBridge} />
      ) : null}
      {runtimeNeeds.referenceLaps ? (
        <ReferenceStoreProvider bridge={window.channelBridge} />
      ) : null}
    </>
  );
};
