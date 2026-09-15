import { useMemo } from 'react';
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
}: {
  browser?: boolean;
}) => {
  const widgets = useWidgetsForThisDisplay(browser);
  const runtimeNeeds = useMemo(
    () => ({
      telemetryInspector: rendererNeedsTelemetryInspector(widgets),
      referenceLaps: rendererNeedsChannel(widgets, 'reference-laps.snapshot'),
      sessionData: rendererNeedsSessionData(widgets),
      pitLaneData: rendererNeedsPitLaneData(widgets),
    }),
    [widgets]
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
