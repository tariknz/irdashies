import { useMemo } from 'react';
import {
  PitLaneProvider,
  ReferenceStoreProvider,
  SessionProvider,
  TelemetryInspectorProvider,
  useDashboard,
} from '@irdashies/context';
import {
  rendererNeedsChannel,
  rendererNeedsTelemetryInspector,
  rendererNeedsPitLaneData,
  rendererNeedsSessionData,
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
      telemetryInspector: rendererNeedsTelemetryInspector(widgets),
      referenceLaps: rendererNeedsChannel(widgets, 'reference-laps.snapshot'),
      sessionData: rendererNeedsSessionData(widgets),
      pitLaneData: rendererNeedsPitLaneData(widgets),
    };
  }, [browser, containerBoundsInfo, currentDashboard?.widgets]);

  if (
    !runtimeNeeds.telemetryInspector &&
    !runtimeNeeds.referenceLaps &&
    !runtimeNeeds.sessionData &&
    !runtimeNeeds.pitLaneData
  )
    return null;

  return (
    <>
      {runtimeNeeds.sessionData ? (
        <SessionProvider bridge={window.irsdkBridge} />
      ) : null}
      {runtimeNeeds.telemetryInspector ? (
        <TelemetryInspectorProvider bridge={window.telemetryInspectorBridge} />
      ) : null}
      {runtimeNeeds.pitLaneData && window.pitLaneBridge ? (
        <PitLaneProvider bridge={window.pitLaneBridge} />
      ) : null}
      {runtimeNeeds.referenceLaps ? (
        <ReferenceStoreProvider bridge={window.channelBridge} />
      ) : null}
    </>
  );
};
