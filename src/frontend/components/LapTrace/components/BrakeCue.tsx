import { useRef } from 'react';
import type { LapTraceColors, LapTraceSound } from '@irdashies/types';
import {
  BrakeCueBars,
  BRAKE_CUE_BAR_COUNT,
  type BrakeCueBarSide,
} from './BrakeCueBars';
import { useBrakeCue } from '../hooks/useBrakeCue';

export interface BrakeCueProps {
  /** Filtered reference brake points, in metres along the lap. */
  cuePointsM: Float32Array;
  showBars: boolean;
  /** Which edge of the widget the strip sits on. */
  barSide: BrakeCueBarSide;
  /** Which end the final bar sits at. Vertical sides only. */
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
  carDistanceMOverride?: number;
}

/**
 * Owns the countdown's refs and its single telemetry loop.
 *
 * Mounted by the widget only when a reference lap exists and at least one
 * output is switched on, so the feature costs nothing at all when it is off —
 * no subscription, no animation frame.
 */
export const BrakeCue = ({
  cuePointsM,
  showBars,
  barSide,
  lastBar,
  playAudio,
  volume,
  audioCueLeadSec,
  audioDeviceId,
  cues,
  colors,
  carDistanceMOverride,
}: BrakeCueProps) => {
  const strip = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLDivElement | null)[]>(
    new Array(BRAKE_CUE_BAR_COUNT).fill(null)
  );
  const fill = useRef<HTMLDivElement>(null);
  const distance = useRef<HTMLSpanElement>(null);
  const refs = useRef({ strip, bars, fill, distance }).current;

  useBrakeCue(refs, {
    cuePointsM,
    showBars,
    side: barSide,
    lastBar,
    playAudio,
    volume,
    audioCueLeadSec,
    audioDeviceId,
    cues,
    colors,
    carDistanceMOverride,
  });

  if (!showBars) return null;
  return (
    <BrakeCueBars
      stripRef={strip}
      barsRef={bars}
      fillRef={fill}
      distanceRef={distance}
      side={barSide}
      lastBar={lastBar}
    />
  );
};
