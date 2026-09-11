import { useEffect, useRef, type RefObject } from 'react';
import type {
  BrakeCueTone,
  LapTraceColors,
  LapTraceSound,
} from '@irdashies/types';
import { getChannelSnapshotStore, useLapTraceStore } from '@irdashies/context';
import {
  playBrakeCue,
  primeBrakeCueAudio,
  setBrakeCueOutputDevice,
} from '@irdashies/utils/brakeCueAudio';
import type { LapTraceSamples } from '@irdashies/types';
import {
  normalisePct,
  valueAtDistance,
} from '../../../domain/lapTrace/lapSamples';
import {
  createBrakeCueLatch,
  createBrakeCueOutput,
  resetBrakeCueLatch,
  stepBrakeCueLatch,
} from '../../../domain/lapTrace/brakeCueLatch';
import {
  BRAKE_CUE_BAR_COUNT,
  BRAKE_CUE_UNLIT_COLOR,
  brakeCueColor,
  isBrakeCueBarLit,
  isBrakeCueHorizontal,
  type BrakeCueBarSide,
} from '../components/BrakeCueBars';

/**
 * The reference's speed at the car's position, for the pace gate. A stored lap
 * ends a sample short of the line, so just before it the nearest end sample
 * stands in rather than reading as "not driving".
 */
function referenceSpeedAt(samples: LapTraceSamples, distanceM: number): number {
  const n = samples.length;
  if (n === 0) return 0;
  const interpolated = valueAtDistance(samples, samples.speed, distanceM);
  if (Number.isFinite(interpolated)) return interpolated;
  return distanceM < samples.distanceM[0]
    ? samples.speed[0]
    : samples.speed[n - 1];
}

export interface BrakeCueRefs {
  strip: RefObject<HTMLDivElement | null>;
  /** Vertical (`left`/`right`) sides only. */
  bars: RefObject<(HTMLDivElement | null)[]>;
  /** The single continuous fill bar. Horizontal (`top`/`bottom`) sides only. */
  fill: RefObject<HTMLDivElement | null>;
  /** Distance-to-brake-point readout. */
  distance: RefObject<HTMLSpanElement | null>;
}

export interface BrakeCueOptions {
  /** Filtered reference brake points. A new identity resets the latch. */
  cuePointsM: Float32Array;
  showBars: boolean;
  /** Which edge of the widget the strip sits on. */
  side: BrakeCueBarSide;
  /** Which end the final bar sits at. 'top' drains downwards. Vertical sides only. */
  lastBar: 'top' | 'bottom';
  playAudio: boolean;
  /** 0..1 */
  volume: number;
  /** Seconds to play each cue before its visual timing. */
  audioCueLeadSec: number;
  /** System playback device for the cues; DEFAULT_AUDIO_OUTPUT_DEVICE_ID follows Windows. */
  audioDeviceId?: string;
  /** Per-cue tone synthesis. Omitted → the built-in defaults. */
  cues?: LapTraceSound;
  /** Countdown ladder colours (green/amber/orange/red). */
  colors: LapTraceColors;
  /** Story/testing hook: pin the car to a fixed distance along the lap. */
  carDistanceMOverride?: number;
}

/**
 * Drives the brake-point countdown: one telemetry subscription and one rAF
 * loop feeding both outputs.
 *
 * Telemetry is read through a direct store subscription rather than a hook
 * (R2.3) and the bars are updated by mutating their DOM, so the widget never
 * re-renders at telemetry rate — the only React renders in the whole feature
 * come from settings changes and the reference lap appearing.
 */
export const useBrakeCue = (
  refs: BrakeCueRefs,
  {
    cuePointsM,
    showBars,
    side,
    lastBar,
    playAudio,
    volume,
    audioCueLeadSec,
    audioDeviceId,
    cues,
    colors,
    carDistanceMOverride,
  }: BrakeCueOptions
): void => {
  const sample = useRef({
    lapDistPct: -1,
    speedMs: 0,
    sessionTime: -1,
    isOnTrack: false,
    onPitRoad: false,
    isReplayPlaying: false,
  });

  // The latch lives in a ref, not in the effect: the effect re-runs whenever the
  // config changes (nudging the volume slider mid-lap), and an effect-local
  // latch would be rebuilt and could re-fire a cue. Resetting at setup instead
  // gives a deterministic, silent re-arm.
  const latch = useRef(createBrakeCueLatch());
  const output = useRef(createBrakeCueOutput());

  useEffect(() => {
    if (carDistanceMOverride !== undefined) return;
    const bridge = window.channelBridge;
    if (!bridge) return;

    const store = getChannelSnapshotStore('track-state.snapshot', bridge);
    // The whole snapshot: six fields, one selection. This is a third selection
    // on a store useLapTraceFrame and useLastCornerComparison already share —
    // the store requests the highest rate across selections, so subscribing
    // again does not increase bridge traffic.
    const selection = store.createSelection((s) => s);

    return selection.subscribe(() => {
      const snapshot = selection.getSnapshot();
      if (!snapshot) return;
      const current = sample.current;
      current.lapDistPct = snapshot.lapDistPct;
      current.speedMs = snapshot.speed;
      current.sessionTime = snapshot.sessionTime;
      current.isOnTrack = snapshot.isOnTrack;
      current.onPitRoad = snapshot.onPitRoad;
      current.isReplayPlaying = snapshot.isReplayPlaying;
    });
  }, [carDistanceMOverride]);

  useEffect(() => {
    resetBrakeCueLatch(latch.current);
    if (playAudio && volume > 0) {
      // Select the device before priming, so the context is opened on the
      // right sink rather than being switched after the fact.
      setBrakeCueOutputDevice(audioDeviceId);
      primeBrakeCueAudio();
    }

    const horizontal = isBrakeCueHorizontal(side);

    let raf = 0;
    // Track what was last written rather than reading style back: the CSSOM
    // normalises `rgb(34 197 94)` to `rgb(34, 197, 94)`, so a read-back compare
    // never matches and would repaint every frame.
    let lastBars = -1;
    let lastTone: BrakeCueTone = 'off';
    let lastFillWidth = '';
    let lastDistanceText = '';

    const draw = () => {
      raf = requestAnimationFrame(draw);

      // Read fresh every frame: the active lap's buffers are reset in place at
      // each lap boundary, so a captured reference can go stale.
      const { trackLengthM, referenceLap } = useLapTraceStore.getState();
      const current = sample.current;
      const pct = normalisePct(current.lapDistPct);
      const carDistanceM = carDistanceMOverride ?? pct * trackLengthM;

      // Reference speed here on track, for the pace gate.
      const referenceSpeedMs = referenceLap
        ? referenceSpeedAt(referenceLap.samples, carDistanceM)
        : 0;

      const out = stepBrakeCueLatch(latch.current, output.current, {
        carDistanceM,
        speedMs: current.speedMs,
        sessionTime: current.sessionTime,
        trackLengthM,
        cuePointsM,
        cuePointCount: cuePointsM.length,
        referenceSpeedMs,
        audioCueLeadSec,
        driving:
          current.isOnTrack &&
          !current.onPitRoad &&
          !current.isReplayPlaying &&
          !!referenceLap,
      });

      if (out.fire && playAudio) playBrakeCue(out.fire, volume, cues);

      if (!showBars) return;

      if (out.bars !== lastBars || out.tone !== lastTone) {
        const strip = refs.strip.current;
        // visibility, not display: the strip must keep its footprint so the
        // plot beside/above/below it does not resize every time a braking
        // zone starts or ends.
        if (strip) {
          strip.style.visibility = out.bars > 0 ? 'visible' : 'hidden';
        }

        if (horizontal) {
          const fill = refs.fill.current;
          if (fill && out.bars > 0) {
            fill.style.backgroundColor = brakeCueColor(out.tone, colors);
          }
        } else {
          const bars = refs.bars.current;
          if (bars && out.bars > 0) {
            const lit = brakeCueColor(out.tone, colors);
            for (let i = 0; i < BRAKE_CUE_BAR_COUNT; i++) {
              const el = bars[i];
              if (!el) continue;
              el.style.backgroundColor = isBrakeCueBarLit(i, out.bars, lastBar)
                ? lit
                : BRAKE_CUE_UNLIT_COLOR;
            }
          }
        }
        lastBars = out.bars;
        lastTone = out.tone;
      }

      // The fill's width and the distance readout are continuous — they
      // change every frame while approaching, unlike the discrete bars/tone
      // ladder above, so they are updated unconditionally here rather than
      // inside the bars/tone-change gate.
      if (horizontal) {
        const fill = refs.fill.current;
        if (fill) {
          const widthPct = out.bars > 0 ? Math.round(out.progress * 100) : 0;
          const width = `${widthPct}%`;
          if (width !== lastFillWidth) {
            fill.style.width = width;
            lastFillWidth = width;
          }
        }
      }

      const distanceEl = refs.distance.current;
      if (distanceEl) {
        const text =
          out.tone === 'red'
            ? 'BRAKE'
            : Number.isFinite(out.distanceM)
              ? `${Math.max(0, Math.round(out.distanceM))}m`
              : '';
        if (text !== lastDistanceText) {
          distanceEl.textContent = text;
          if (text) {
            distanceEl.style.color = brakeCueColor(out.tone, colors);
          }
          lastDistanceText = text;
        }
      }
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      const strip = refs.strip.current;
      if (strip) strip.style.visibility = 'hidden';
    };
  }, [
    refs,
    side,
    cuePointsM,
    showBars,
    lastBar,
    playAudio,
    volume,
    audioCueLeadSec,
    audioDeviceId,
    cues,
    colors,
    carDistanceMOverride,
  ]);
};
