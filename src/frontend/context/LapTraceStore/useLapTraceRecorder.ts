import { useEffect, useRef } from 'react';
import type { LapTraceSource, Session } from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import { useSessionStore } from '../SessionStore/SessionStore';
import { getChannelSnapshotStore } from '../ChannelStore/ChannelSnapshotStore';
import { useLapTraceStore } from './LapTraceStore';

/**
 * Feeds the lap trace recorder from telemetry.
 *
 * One channel, `lap-trace.sample`, carries everything the recorder needs from
 * a single telemetry frame — pedals, speed, position and time co-sampled — so
 * each sample goes into the store exactly as the sim measured it. (Pairing
 * pedals from one channel with a position from another would tag every sample
 * with a position up to a delivery interval stale.)
 *
 * Subscribes to the stores directly rather than through hooks (R2.3): this runs
 * at telemetry rate and a hook subscription would re-run as a React dependency
 * on every frame. All mutable state lives in a ref, and the per-frame body does
 * no allocation — it appends to typed arrays and compares a few scalars.
 *
 * Pedal inputs are deliberately not rounded (the no-round list in
 * ARCHITECTURE_RULES §2.3) — this is a recorder, not a render path.
 */
export const useLapTraceRecorder = (referenceSource: LapTraceSource) => {
  const sourceRef = useRef(referenceSource);
  sourceRef.current = referenceSource;

  const sessionRef = useRef({
    trackId: -1,
    trackConfigName: '',
    carPath: '',
    trackLengthM: -1,
    sessionNum: -1,
    subSessionId: -1,
  });

  useEffect(() => {
    const bridge = window.lapTraceBridge;
    const { initialize, collectPlayerFrame, setReferenceFromSource, reset } =
      useLapTraceStore.getState();

    // The ref holds a stable object that is mutated in place, never reassigned,
    // so capturing it here is safe and keeps the cleanup honest.
    const s = sessionRef.current;

    const bootstrap = async (
      trackId: number,
      trackConfigName: string,
      carPath: string,
      trackLengthM: number
    ) => {
      await initialize(bridge, trackId, trackConfigName, carPath, trackLengthM);
      await setReferenceFromSource(bridge, sourceRef.current);
    };

    const onSession = (state: { session: Session | null }) => {
      const session = state.session;
      if (!session) return;

      const trackId = session.WeekendInfo?.TrackID ?? -1;
      const playerCarIdx = session.DriverInfo?.DriverCarIdx ?? -1;
      const drivers = session.DriverInfo?.Drivers ?? [];
      const carPath =
        drivers.find((d) => d.CarIdx === playerCarIdx)?.CarPath ?? '';

      // Both are required for the storage key — recording before the driver is
      // known would file lap 1 under the wrong car.
      if (trackId <= 0 || !carPath) return;

      const trackConfigName = session.WeekendInfo?.TrackConfigName ?? '';
      const subSessionId = session.WeekendInfo?.SubSessionID ?? -1;

      const lengthStr = session.WeekendInfo?.TrackLength;
      const [val, unit] = lengthStr?.split(' ') ?? [];
      const trackLengthM =
        unit === 'km' ? parseFloat(val) * 1000 : parseFloat(val);
      if (!Number.isFinite(trackLengthM) || trackLengthM <= 0) return;

      if (
        trackId === s.trackId &&
        trackConfigName === s.trackConfigName &&
        carPath === s.carPath &&
        trackLengthM === s.trackLengthM &&
        subSessionId === s.subSessionId
      ) {
        return;
      }

      // Diagnostic: identify exactly which field triggered the reset — fires
      // on real session changes too, but pinpoints the field when this fires
      // unexpectedly mid-session with no disconnect in between.
      const changed: string[] = [];
      if (trackId !== s.trackId) {
        changed.push(`trackId ${s.trackId}->${trackId}`);
      }
      if (trackConfigName !== s.trackConfigName) {
        changed.push(
          `trackConfigName "${s.trackConfigName}"->"${trackConfigName}"`
        );
      }
      if (carPath !== s.carPath) {
        changed.push(`carPath "${s.carPath}"->"${carPath}"`);
      }
      if (trackLengthM !== s.trackLengthM) {
        changed.push(`trackLengthM ${s.trackLengthM}->${trackLengthM}`);
      }
      if (subSessionId !== s.subSessionId) {
        changed.push(`subSessionId ${s.subSessionId}->${subSessionId}`);
      }
      logger.info(
        `[LapTrace] Session changed, initializing recorder... (${changed.join(', ')})`
      );
      Object.assign(s, {
        trackId,
        trackConfigName,
        carPath,
        trackLengthM,
        subSessionId,
      });
      void bootstrap(trackId, trackConfigName, carPath, trackLengthM);
    };

    const unsubSession = useSessionStore.subscribe(onSession);
    // Seed from what the store already holds. `subscribe` only fires on later
    // changes, and the session providers live outside the hide wrapper, so a
    // recorder remounted after Alt+H would otherwise sit idle until iRacing
    // next republished its session — which in a solo stint may be never. The
    // identity comparison above makes this a no-op when nothing changed.
    onSession(useSessionStore.getState());

    const channelBridge = window.channelBridge;
    const sampleStore = getChannelSnapshotStore(
      'lap-trace.sample',
      channelBridge
    );
    // Object.is is a safe equality here: IPC structured-clones every delivery
    // into a fresh object, so each frame is a change and none is skipped.
    const sampleSelection = sampleStore.createSelection(
      (c) => c,
      Object.is,
      60
    );

    const onSample = () => {
      const sample = sampleSelection.getSnapshot();
      if (!sample) return;
      if (s.trackId <= 0) return;

      const sessionNum = sample.sessionNum ?? -1;
      if (sessionNum !== s.sessionNum) {
        if (s.sessionNum !== -1) {
          logger.info(
            `[LapTrace] SessionNum changed to ${sessionNum}, restarting recorder...`
          );
          void bootstrap(
            s.trackId,
            s.trackConfigName,
            s.carPath,
            s.trackLengthM
          );
        }
        s.sessionNum = sessionNum;
      }

      collectPlayerFrame(bridge, sample);
    };

    const unsubSamples = sampleSelection.subscribe(onSample);

    // Settings runs in its own window/store: when it imports or clears a lap,
    // main relays it here so the overlay re-reads from disk without a hide/show.
    const unsubReferenceUpdated = bridge?.onReferenceUpdated?.(() => {
      const { setReferenceFromSource } = useLapTraceStore.getState();
      void setReferenceFromSource(bridge, sourceRef.current);
    });
    const unsubClearBest = bridge?.onClearBestLap?.(() => {
      void useLapTraceStore.getState().clearBestLap(bridge);
    });

    return () => {
      unsubSession();
      unsubSamples();
      unsubReferenceUpdated?.();
      unsubClearBest?.();
      reset();
      s.trackId = -1;
      s.sessionNum = -1;
    };
  }, []);

  // Reload the reference when the user switches source in settings.
  useEffect(() => {
    const bridge = window.lapTraceBridge;
    if (!bridge) return;
    void useLapTraceStore
      .getState()
      .setReferenceFromSource(bridge, referenceSource);
  }, [referenceSource]);
};
