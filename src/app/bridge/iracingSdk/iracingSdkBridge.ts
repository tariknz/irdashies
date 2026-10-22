import { IRacingSDK } from '../../irsdk';
import { OverlayManager } from '../../overlayManager';
import { TelemetryPerfMetrics } from '../../perfMetrics';
import {
  getPerfRunConfig,
  PERF_REPLAY_READY_LOG_MARKER,
} from '../../perfRunConfig';
import {
  TELEMETRY_INSPECTOR_RATE_HZ,
  type IrSdkSourceBridge,
  type Session,
  type Telemetry,
  type TapeReplayCommand,
} from '@irdashies/types';
import logger from '../../logger';
import type { SessionLifecycle } from '../../sessionLifecycle';
import type { ChannelBus } from '../channelBridge';
import { createDefaultProcessorHost } from '../../processors/processorRegistry';
import { getActiveRacePlan } from '../../services/racePlanSource';

// Keys consumed by the renderer. Anything outside this set is dropped before
// the telemetry object crosses the IPC boundary — reducing structured-clone
// payload from ~340 keys to ~60 and cutting IPC fanout cost (finding P1).
const TELEMETRY_ALLOWLIST = new Set<keyof Telemetry>([
  'AirTemp',
  'BrakeABSactive',
  'Brake',
  'BrakeRaw',
  'CamCarIdx',
  'CarIdxBestLapTime',
  'CarIdxClass',
  'CarIdxClassPosition',
  'CarIdxEstTime',
  'CarIdxF2Time',
  'CarIdxLap',
  'CarIdxLapCompleted',
  'CarIdxLapDistPct',
  'CarIdxLastLapTime',
  'CarIdxOnPitRoad',
  'CarIdxP2P_Count',
  'CarIdxP2P_Status',
  'CarIdxPosition',
  'CarIdxSessionFlags',
  'CarIdxTireCompound',
  'CarIdxTrackSurface',
  'CarLeftRight',
  'Clutch',
  'ClutchRaw',
  'DisplayUnits',
  'EngineWarnings',
  'FuelLevel',
  'FuelLevelPct',
  'Gear',
  'IsGarageVisible',
  'IsInGarage',
  'IsOnTrack',
  'IsReplayPlaying',
  'Lap',
  'LapBestLapTime',
  'LapCompleted',
  'LapCurrentLapTime',
  'LapDistPct',
  'LapLastLapTime',
  'OnPitRoad',
  'OilTemp',
  'WaterTemp',
  'PitstopActive',
  'PlayerCarInPitStall',
  'PlayerCarMyIncidentCount',
  'PlayerCarTeamIncidentCount',
  'PlayerCarTowTime',
  'PlayerTrackSurface',
  'LapDeltaToSessionBestLap',
  'LapDeltaToSessionBestLap_OK',
  'LapDeltaToSessionLastlLap',
  'LapDeltaToSessionLastlLap_OK',
  'Precipitation',
  'RPM',
  'RelativeHumidity',
  'ReplayFrameNum',
  'SessionFlags',
  'SessionLapsRemain',
  'SessionNum',
  'SessionState',
  'SessionTime',
  'SessionTimeOfDay',
  'SessionTimeRemain',
  'SessionTimeTotal',
  'SessionUniqueID',
  'ShiftGrindRPM',
  'Speed',
  'SteeringWheelAngle',
  'Throttle',
  'ThrottleRaw',
  'TrackTempCrew',
  'TrackWetness',
  'WindDir',
  'WindVel',
  'YawNorth',
  'dcBrakeBias',
  'dcPeakBrakeBias',
  'dcPitSpeedLimiterToggle',
]);

function trimTelemetry(telemetry: Telemetry): Partial<Telemetry> {
  const trimmed: Partial<Telemetry> = {};
  for (const key of TELEMETRY_ALLOWLIST) {
    if (key in telemetry) {
      (trimmed as Record<string, unknown>)[key] = (
        telemetry as Record<string, unknown>
      )[key];
    }
  }
  return trimmed;
}

const perfRunConfig = getPerfRunConfig();
const perfTelemetryDeliveryEnabled =
  !perfRunConfig.enabled || perfRunConfig.telemetryDelivery === 'on';
const perfRawTelemetryEnabled =
  perfRunConfig.enabled && perfRunConfig.telemetryPayload === 'raw';

function telemetryForRenderer(
  telemetry: Telemetry
): Telemetry | Partial<Telemetry> {
  return perfRawTelemetryEnabled ? telemetry : trimTelemetry(telemetry);
}

// Short timeout for waitForData to avoid blocking the main thread.
// The native SDK's WaitForSingleObject blocks synchronously, so keep this
// small to keep the event loop responsive.
const WAIT_TIMEOUT = 16;
// How long to sleep between connection retry attempts when iRacing isn't running.
const RETRY_INTERVAL = 1000;
// How often to ask the SDK for session data. The native getSessionData() copies
// and transcodes the whole session YAML on every call even when nothing has
// changed, and currDataVersion only refreshes as a side effect of that call, so
// there is no cheap way to check first. Polling at 2 Hz bounds session-change
// detection latency to about 500 ms while avoiding work on every telemetry tick.
const SESSION_POLL_INTERVAL = 500;

/**
 * Isolate synchronous subscriber failures without interrupting SDK delivery.
 * Log a persistent failure once, then allow logging again after recovery.
 */
function createSubscriberNotifier() {
  const failed = new WeakSet<object>();
  return <T>(callback: (value: T) => void, value: T): void => {
    try {
      callback(value);
      failed.delete(callback);
    } catch (error) {
      if (!failed.has(callback)) {
        failed.add(callback);
        logger.error('[iracingSdkBridge] Subscriber failed', error);
      }
    }
  };
}

/**
 * Start live or tape SDK polling, retrying read failures until stopped.
 * The returned bridge owns all acquired resources; stopping it synchronously
 * disconnects an entered lifecycle and releases resources even if cleanup fails.
 * Initialization failures release acquired resources and rethrow the cause.
 */
export async function publishIRacingSDKEvents(
  overlayManager: OverlayManager,
  lifecycle?: SessionLifecycle,
  channelBus?: ChannelBus
): Promise<IrSdkSourceBridge> {
  logger.info('[iracingSdkBridge] Loading iRacing SDK bridge...');
  const isTapeReplay = Boolean(process.env.IRDASHIES_TELEMETRY_REPLAY);
  const sourceName = isTapeReplay ? 'telemetry replay' : 'iRacing';

  const perfMetrics = new TelemetryPerfMetrics(undefined, channelBus);
  let shouldStop = false;
  const disposers: (() => void)[] = [];
  /** Release acquired resources once, continuing if an individual cleanup fails. */
  const stop = () => {
    if (shouldStop) return;
    shouldStop = true;
    // Reverse acquisition order, including when initialization only partly ran.
    for (let index = disposers.length - 1; index >= 0; index--) {
      try {
        disposers[index]();
      } catch (error) {
        logger.error('[iracingSdkBridge] Cleanup failed', error);
      }
    }
    disposers.length = 0;
  };
  const notify = createSubscriberNotifier();

  try {
    disposers.push(() => perfMetrics.stopReporting());
    perfMetrics.startReporting();
    const referenceLapStorage = channelBus
      ? await import('../../storage/referenceLaps')
      : undefined;
    const radarTuningStorage = channelBus
      ? await import('../../storage/radarTuning')
      : undefined;
    const radarPoleSideStorage = channelBus
      ? await import('../../storage/radarPoleSideOverrides')
      : undefined;
    await radarPoleSideStorage?.loadRadarPoleSideOverrides();
    const racePlanHistory = channelBus
      ? (
          await import('../../storage/racePlanHistory')
        ).getRacePlanHistoryStore()
      : undefined;
    await racePlanHistory?.load();
    const processorHost =
      channelBus && referenceLapStorage
        ? createDefaultProcessorHost({
            bus: channelBus,
            lifecycle,
            metrics: perfMetrics,
            aggregateReplay: isTapeReplay,
            logError: (message, error) => logger.error(message, error),
            referenceLapPersistence: {
              load: referenceLapStorage.getReferenceLap,
              save: referenceLapStorage.saveReferenceLap,
            },
            radarTuning: radarTuningStorage?.getRadarTuning,
            radarPoleSides: radarPoleSideStorage?.radarPoleSideOverrides,
            racePlan: racePlanHistory && {
              getPlan: getActiveRacePlan,
              persistence: {
                load: (subSessionId) => racePlanHistory.get(subSessionId),
                save: (record) => racePlanHistory.save(record),
              },
            },
          })
        : undefined;

    if (processorHost) disposers.push(() => processorHost.dispose());

    let lastRunningState: boolean | undefined = undefined;
    let latestSession: Session | null = null;
    disposers.push(() => {
      latestSession = null;
      overlayManager.clearLatestSessionData?.();
    });
    let replayRefreshPending = false;
    const offReplayDemand = isTapeReplay
      ? channelBus?.onSubscriberCountChanged((_channel, activeCount) => {
          if (activeCount > 0) replayRefreshPending = true;
        })
      : undefined;

    if (offReplayDemand) disposers.push(offReplayDemand);

    const telemetryCallbacks = new Set<(value: Telemetry) => void>();
    const sessionCallbacks = new Set<(value: Session) => void>();
    const runningStateCallbacks = new Set<(value: boolean) => void>();

    disposers.push(() => {
      telemetryCallbacks.clear();
      sessionCallbacks.clear();
      runningStateCallbacks.clear();
    });

    // Removed in stop(): every demo toggle builds a new bridge.
    const offOverlayReady = overlayManager.onOverlayReady((id) => {
      logger.info(
        '[iracingSdkBridge] New window ready, sending initial data: ',
        id
      );
      if (lastRunningState !== undefined)
        overlayManager.publishMessageToOverlay(
          id,
          'runningState',
          lastRunningState
        );
      if (latestSession)
        overlayManager.publishMessageToOverlay(
          id,
          'sessionData',
          latestSession
        );
    });

    disposers.push(offOverlayReady);

    const sdk = new IRacingSDK();
    disposers.push(() => sdk.stopSDK());
    sdk.autoEnableTelemetry = true;
    await sdk.ready();
    if (
      perfRunConfig.enabled &&
      (process.env.IRDASHIES_IRSDK_REPLAY === '1' || isTapeReplay)
    ) {
      logger.info(PERF_REPLAY_READY_LOG_MARKER);
    }

    // Seed the running state immediately so the renderer doesn't sit on the
    // previous bridge's last value (e.g. a stale demo frame) until the first
    // interval tick 5s later — this is what made exiting demo mode feel slow.
    const initialRunningState = sdk.sessionStatusOK;
    lastRunningState = initialRunningState;
    let isLifecycleEntered = false;
    let pollingFailed = false;
    disposers.push(() => {
      if (!isLifecycleEntered) return;
      // Stop synchronously resets the shared lifecycle before another source
      // can enter it. The telemetry loop skips its teardown once stopped.
      isLifecycleEntered = false;
      lifecycle?._onDisconnect();
    });
    overlayManager.publishMessage('runningState', initialRunningState);
    runningStateCallbacks.forEach((callback) =>
      notify(callback, initialRunningState)
    );

    /** Publish each state transition once, whether polling or a frame detects it. */
    const publishRunningState = (isSimRunning: boolean) => {
      if (isSimRunning === lastRunningState) {
        return;
      }
      lastRunningState = isSimRunning;
      logger.info(
        '[iracingSdkBridge] Sending running state to window',
        isSimRunning
      );
      overlayManager.publishMessage('runningState', isSimRunning);
      runningStateCallbacks.forEach((callback) =>
        notify(callback, isSimRunning)
      );
    };

    const runningStateInterval = setInterval(() => {
      try {
        // A polling error owns the disconnected state until a frame proves
        // that telemetry delivery has recovered.
        if (!pollingFailed) publishRunningState(sdk.sessionStatusOK);
      } catch (error) {
        logger.error('[iracingSdkBridge] Running-state poll failed', error);
      }
    }, 5000);
    disposers.push(() => clearInterval(runningStateInterval));

    // Reuse the completion callback on every tick; stop also wakes the delay.
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let resolveDelay: (() => void) | undefined;
    /** Clear the current delay and wake the polling loop, including during stop. */
    const finishDelay = () => {
      clearTimeout(delayTimer);
      delayTimer = undefined;
      const resolve = resolveDelay;
      resolveDelay = undefined;
      resolve?.();
    };
    /** Wait between polls or retries, resolving immediately once stopped. */
    const delay = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        if (shouldStop) {
          resolve();
          return;
        }
        resolveDelay = resolve;
        delayTimer = setTimeout(finishDelay, milliseconds);
      });
    disposers.push(finishDelay);

    // Start the telemetry loop in the background
    (async () => {
      while (!shouldStop) {
        let lastSessionVersion = -1;
        let lastInspectorTelemetryPublishTime = Number.NEGATIVE_INFINITY;
        // Negative infinity makes the first tick fetch and publish immediately.
        let lastSessionPollTime = Number.NEGATIVE_INFINITY;
        let hadLifecycleEntry = false;

        try {
          while (!shouldStop) {
            const pollStartedAt = performance.now();
            const hasNewData = sdk.waitForData(WAIT_TIMEOUT);
            if (!hasNewData) {
              // A paused replay remains connected but does not advance the SDK's
              // telemetry buffer. Keep the current session and channel snapshots
              // until either playback resumes or the SDK actually disconnects.
              if (sdk.sessionStatusOK) {
                // A seek remounts widgets after the disconnect. Their processors
                // may activate after the single destination frame was consumed.
                // Seed that new demand once, even when the tape stays paused.
                if (replayRefreshPending) {
                  replayRefreshPending = false;
                  if (latestSession && sdk.getTapeReplayStatus()?.paused) {
                    perfMetrics.markStart('tapeReplayRefresh');
                    processorHost?.onFrame(sdk.getTelemetry());
                    perfMetrics.markEnd('tapeReplayRefresh');
                  }
                }
                const remainingDelay = Math.max(
                  0,
                  1000 / 25 - (performance.now() - pollStartedAt)
                );
                await delay(remainingDelay);
                continue;
              }
              break;
            }
            // This frame already satisfies pending subscriber demand.
            replayRefreshPending = false;
            if (!hadLifecycleEntry) {
              logger.info(`[iracingSdkBridge] ${sourceName} is running`);
              hadLifecycleEntry = true;
              isLifecycleEntered = true;
              pollingFailed = false;
              // sessionStatusOK can still read false when the bridge seeds it, so
              // the arrival of real data is the earliest reliable proof the sim is
              // up. Without this the overlays wait out the 5s poll before showing
              // anything.
              publishRunningState(true);
              lifecycle?._onEnter({ replay: isTapeReplay });
            }
            perfMetrics.markStart('processTelemetry');
            perfMetrics.markStart('sdkTelemetryRead');
            const telemetry = sdk.getTelemetry();
            perfMetrics.markEnd('sdkTelemetryRead');
            const tickTime = performance.now();
            let session: Session | null = null;
            if (tickTime - lastSessionPollTime >= SESSION_POLL_INTERVAL) {
              lastSessionPollTime = tickTime;
              perfMetrics.markStart('sdkSessionRead');
              session = sdk.getSessionData();
              perfMetrics.markEnd('sdkSessionRead');
            }

            // Initialise processors before the frame: a paused seek may only
            // publish this one frame until the user resumes playback.
            if (session && sdk.currDataVersion !== lastSessionVersion) {
              perfMetrics.markStart('sessionPublish');
              lastSessionVersion = sdk.currDataVersion;
              latestSession = session;
              lifecycle?._onSession(session);
              processorHost?.onSession(session);
              overlayManager.publishMessage('sessionData', session);
              sessionCallbacks.forEach((callback) => notify(callback, session));
              perfMetrics.markEnd('sessionPublish');
            }

            if (telemetry) {
              perfMetrics.markStart('lifecycleTelemetry');
              lifecycle?._onTelemetry(telemetry);
              perfMetrics.markEnd('lifecycleTelemetry');
              processorHost?.onFrame(telemetry);
              if (
                perfTelemetryDeliveryEnabled &&
                overlayManager.hasTelemetryInspectorSubscribers() &&
                tickTime - lastInspectorTelemetryPublishTime >=
                  1000 / TELEMETRY_INSPECTOR_RATE_HZ
              ) {
                lastInspectorTelemetryPublishTime = tickTime;
                perfMetrics.markStart('telemetryProjection');
                const rendererTelemetry = telemetryForRenderer(telemetry);
                perfMetrics.markEnd('telemetryProjection');
                perfMetrics.markStart('broadcast');
                overlayManager.publishMessage(
                  'telemetryInspector:telemetry',
                  rendererTelemetry
                );
                perfMetrics.markEnd('broadcast');
              }
              perfMetrics.markStart('telemetryCallbacks');
              telemetryCallbacks.forEach((callback) =>
                notify(callback, telemetry)
              );
              perfMetrics.markEnd('telemetryCallbacks');
            }

            perfMetrics.markEnd('processTelemetry');
            perfMetrics.tick(telemetry);

            // Demand-driven poll rate: 25 Hz to save system resources, raised to
            // the sim's native 60 Hz only while a visible window is subscribed to
            // a 60 Hz channel (LapTrace's sample channel, the Input widget).
            // Processors still tick at their own declared rates, so only the
            // 60 Hz ones do more work. We sleep AFTER publishing so each frame is
            // sent with minimal latency, and subtract the tick's own duration so
            // the rate holds rather than drifting below target.
            const targetHz = Math.min(
              60,
              Math.max(25, channelBus?.maxActiveRateHz() ?? 25)
            );
            const remainingDelay = Math.max(
              0,
              1000 / targetHz - (performance.now() - pollStartedAt)
            );
            await delay(remainingDelay);
          }
        } catch (error) {
          logger.error(
            '[iracingSdkBridge] Telemetry poll failed; retrying',
            error
          );
          pollingFailed = true;
          // A read can fail before the first frame, while the seeded state is up.
          publishRunningState(false);
        }

        if (shouldStop) break;
        if (hadLifecycleEntry) {
          isLifecycleEntered = false;
          publishRunningState(false);
          logger.info(
            `[iracingSdkBridge] ${sourceName} is no longer publishing telemetry`
          );
          // Release the last telemetry/session snapshots so new overlay windows
          // opened during a disconnect don't get re-seeded with stale data, and
          // so the references don't sit in main-process memory indefinitely.
          // They get repopulated on the next successful waitForData tick.
          latestSession = null;
          overlayManager.clearLatestSessionData?.();
          lifecycle?._onDisconnect();
        }

        await delay(isTapeReplay ? 75 : RETRY_INTERVAL);
      }
    })().catch((error: unknown) => {
      // Unexpected failures in disconnect handling must also release the bridge.
      logger.error('[iracingSdkBridge] Telemetry loop stopped', error);
      stop();
    });

    return {
      ...(isTapeReplay
        ? {
            getTapeReplayStatus: () => sdk.getTapeReplayStatus(),
            controlTapeReplay: (command: TapeReplayCommand) =>
              sdk.controlTapeReplay(command),
          }
        : {}),
      onTelemetry: (callback: (value: Telemetry) => void) => {
        telemetryCallbacks.add(callback);
        return () => {
          telemetryCallbacks.delete(callback);
        };
      },
      onSessionData: (callback: (value: Session) => void) => {
        sessionCallbacks.add(callback);
        if (latestSession) notify(callback, latestSession);
        return () => {
          sessionCallbacks.delete(callback);
        };
      },
      onRunningState: (callback: (value: boolean) => void) => {
        runningStateCallbacks.add(callback);
        // Replayed, as the LMU bridge and the mock already do. The state is
        // seeded above and then only published on a change, so a subscriber
        // attaching afterwards -- which auto-detect always does, since it builds
        // this bridge before subscribing to it -- would otherwise never hear
        // that the sim is up, and would read the eventual `false` as a blip
        // rather than a disconnect worth re-probing for.
        if (lastRunningState !== undefined) notify(callback, lastRunningState);
        return () => {
          runningStateCallbacks.delete(callback);
        };
      },
      stop,
      changeCameraNumber: (carNumber, group, camera) =>
        sdk.changeCameraNumber(carNumber, group, camera),
      changeReplayPosition: (position, frame) =>
        sdk.changeReplayPosition(position, frame),
      triggerReplaySessionSearch: (sessionNum, sessionTimeMs) =>
        sdk.triggerReplaySessionSearch(sessionNum, sessionTimeMs),
    };
  } catch (error) {
    stop();
    throw error;
  }
}
