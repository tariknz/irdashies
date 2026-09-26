import { useMemo } from 'react';
import type { DashboardWidget } from '@irdashies/types';
import {
  PitLaneProvider,
  ReferenceStoreProvider,
  SessionProvider,
  TelemetryInspectorProvider,
  useWidgetsForThisDisplay,
} from '@irdashies/context';
import {
  rendererNeedsChannel,
  rendererNeedsTelemetryInspector,
  rendererNeedsPitLaneData,
  rendererNeedsSessionData,
} from '../../widgetRuntime';

export const RendererDataProviders = ({
  browser = false,
  widgets: widgetsOverride,
  sessionAlreadyMounted = false,
}: {
  browser?: boolean;
  /** Mount for these widgets instead of the ones on this display. */
  widgets?: readonly DashboardWidget[];
  /** The window already mounts a SessionProvider of its own. */
  sessionAlreadyMounted?: boolean;
}) => {
  const displayWidgets = useWidgetsForThisDisplay(browser);
  const widgets = widgetsOverride ?? displayWidgets;
  const runtimeNeeds = useMemo(
    () => ({
      telemetryInspector: rendererNeedsTelemetryInspector(widgets),
      referenceLaps: rendererNeedsChannel(widgets, 'reference-laps.snapshot'),
      sessionData: !sessionAlreadyMounted && rendererNeedsSessionData(widgets),
      pitLaneData: rendererNeedsPitLaneData(widgets),
    }),
    [widgets, sessionAlreadyMounted]
  );

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
