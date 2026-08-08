import { generateMockData } from './generateMockData';
import { OverlayManager } from '../../../overlayManager';
import { TelemetryPerfMetrics } from '../../../perfMetrics';
import type { SessionLifecycle } from '../../../sessionLifecycle';
import type { ChannelBus } from '../../channelBridge';
import { CarSpeedsRuntime } from '../../../processors/carSpeedsRuntime';
import { ReferenceLapRuntime } from '../../../processors/referenceLapRuntime';
import { RelativeGapRuntime } from '../../../processors/relativeGapRuntime';
import { SectorTimingRuntime } from '../../../processors/sectorTimingRuntime';
import { StandingsRuntime } from '../../../processors/standingsRuntime';
import { RadioRuntime } from '../../../processors/radioRuntime';
import { SessionTimingRuntime } from '../../../processors/sessionTimingRuntime';
import { LapTimesRuntime } from '../../../processors/lapTimesRuntime';
import { SessionBarRuntime } from '../../../processors/sessionBarRuntime';
import { DriverControlsRuntime } from '../../../processors/driverControlsRuntime';

export async function publishIRacingSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
) {
  const perfMetrics = new TelemetryPerfMetrics();
  perfMetrics.startReporting();

  const bridge = generateMockData();
  const lapTimesRuntime = channelBus
    ? new LapTimesRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const carSpeedsRuntime = channelBus
    ? new CarSpeedsRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const referenceLapRuntime = channelBus
    ? new ReferenceLapRuntime(channelBus, lifecycle, perfMetrics, {
        load: () => null,
        save: () => undefined,
      })
    : undefined;
  const relativeGapRuntime =
    channelBus && referenceLapRuntime
      ? new RelativeGapRuntime(
          channelBus,
          lifecycle,
          perfMetrics,
          referenceLapRuntime
        )
      : undefined;
  const sectorTimingRuntime = channelBus
    ? new SectorTimingRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const standingsRuntime = channelBus
    ? new StandingsRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const radioRuntime = channelBus
    ? new RadioRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const sessionTimingRuntime =
    channelBus && lapTimesRuntime
      ? new SessionTimingRuntime(
          channelBus,
          lifecycle,
          perfMetrics,
          lapTimesRuntime
        )
      : undefined;
  const sessionBarRuntime = channelBus
    ? new SessionBarRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;
  const driverControlsRuntime = channelBus
    ? new DriverControlsRuntime(channelBus, lifecycle, perfMetrics)
    : undefined;

  bridge.onSessionData((session) => {
    carSpeedsRuntime?.onSession(session);
    referenceLapRuntime?.onSession(session);
    relativeGapRuntime?.onSession(session);
    sectorTimingRuntime?.onSession(session);
    standingsRuntime?.onSession(session);
    sessionTimingRuntime?.onSession(session);
    sessionBarRuntime?.onSession(session);
    driverControlsRuntime?.onSession(session);
    overlayManager.publishMessage('sessionData', session);
  });

  bridge.onTelemetry((telemetry) => {
    perfMetrics.markStart('processTelemetry');
    lapTimesRuntime?.onFrame(telemetry);
    carSpeedsRuntime?.onFrame(telemetry);
    referenceLapRuntime?.onFrame(telemetry);
    relativeGapRuntime?.onFrame(telemetry);
    sectorTimingRuntime?.onFrame(telemetry);
    standingsRuntime?.onFrame(telemetry);
    radioRuntime?.onFrame(telemetry);
    sessionTimingRuntime?.onFrame(telemetry);
    sessionBarRuntime?.onFrame(telemetry);
    driverControlsRuntime?.onFrame(telemetry);
    perfMetrics.markStart('broadcast');
    overlayManager.publishMessage('telemetry', telemetry);
    perfMetrics.markEnd('broadcast');
    perfMetrics.markEnd('processTelemetry');
    perfMetrics.tick(telemetry);
  });

  bridge.onRunningState((running) => {
    overlayManager.publishMessage('runningState', running);
  });

  const originalStop = bridge.stop;
  return {
    ...bridge,
    stop: () => {
      carSpeedsRuntime?.dispose();
      lapTimesRuntime?.dispose();
      relativeGapRuntime?.dispose();
      sectorTimingRuntime?.dispose();
      standingsRuntime?.dispose();
      radioRuntime?.dispose();
      sessionTimingRuntime?.dispose();
      sessionBarRuntime?.dispose();
      driverControlsRuntime?.dispose();
      referenceLapRuntime?.dispose();
      perfMetrics.stopReporting();
      originalStop();
    },
  };
}
