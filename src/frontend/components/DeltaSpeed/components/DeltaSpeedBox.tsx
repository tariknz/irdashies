import { memo, useEffect, useRef } from 'react';
import { speedFromKph } from '@irdashies/utils/units';
import { applyUpdateThreshold, clampMagnitude } from '../displayValue';

/**
 * Fill colours as rgb triplets, for variable-alpha backgrounds.
 *
 * Both are the app's default 500 weights, matching the greens and reds used by
 * the fuel and battle widgets. An earlier version pushed the green to green-600
 * for contrast — white on green-500 is about 2.28:1 against green-600's 3.29:1
 * — but it read as a foreign colour next to the rest of the UI, and the number
 * is legible enough in practice because the fill only approaches full opacity
 * at deltas large enough that the colour alone carries the message.
 */
const FASTER_RGB = '34 197 94';
const SLOWER_RGB = '239 68 68';

export type DeltaSpeedDensity = 'normal' | 'compact' | 'ultra';

/**
 * Padding ladder lifted from SessionBar's standalone mode, so this widget
 * matches the InformationBar at every compact setting rather than only at one.
 */
const PADDING: Record<DeltaSpeedDensity, string> = {
  normal: 'px-4 py-2',
  compact: 'px-3 py-1',
  ultra: 'px-2 py-0',
};

export interface DeltaSpeedBoxProps {
  /** Speed delta in km/h. Positive = faster than the reference. */
  deltaKph: number;
  /** Full-scale deflection, expressed in the display unit. */
  scale: number;
  /** Largest magnitude shown numerically, in the display unit. */
  cap: number;
  /** Movement required before the readout changes, in the display unit. */
  updateThreshold: number;
  unit: 'km/h' | 'mph';
  showNumber: boolean;
  /** Follows the app-wide compact mode. */
  density?: DeltaSpeedDensity;
}

/**
 * Fixed-size box whose background fades in with the size of the delta: green
 * when faster than the reference, red when slower, transparent near zero.
 *
 * The colour is a coarse signal for corrections worth looking away for. A
 * driver who is fine-tuning lives near zero, so that range deliberately shows
 * almost no colour — but the number stays fully legible there, because that is
 * exactly where precision matters. Colour earns attention; the number always
 * has it.
 *
 * Deliberately not a filling bar: a bar quantised to pixels visibly jitters at
 * small deltas, which is distracting in precisely the regime a quick driver
 * spends most of their time in. Opacity has no such granularity.
 */
export const DeltaSpeedBox = memo(
  ({
    deltaKph,
    scale,
    cap,
    updateThreshold,
    unit,
    showNumber,
    density = 'normal',
  }: DeltaSpeedBoxProps) => {
    const rawValue = speedFromKph(deltaKph, unit);

    // Intensity tracks the true delta, not the capped one: past the cap the
    // number stops climbing, but the fill should already be saturated there and
    // stay that way.
    //
    // Linear, with no deadzone: a deadzone would blank the widget across the
    // exact range a consistent driver operates in.
    const intensity = Math.min(Math.abs(rawValue) / scale, 1);

    // The held value is the last *committed* reading, so the threshold is
    // always measured against something the user actually saw. Recorded in an
    // effect rather than during render: React can discard an interrupted
    // render, and a render-phase write would leave the ref holding a value that
    // was never displayed, skewing the next comparison. Writing a ref from an
    // effect costs no extra render — only setState would — so this keeps the
    // 25Hz track-state path at one render per tick.
    const heldRef = useRef<number | null>(null);
    const shownValue = applyUpdateThreshold(
      clampMagnitude(rawValue, cap),
      heldRef.current,
      updateThreshold
    );
    useEffect(() => {
      heldRef.current = shownValue;
    }, [shownValue]);

    const isFaster = shownValue >= 0;
    const sign = isFaster ? '+' : '-';
    const text = `${sign}${Math.abs(shownValue).toFixed(1)}`;

    return (
      <div
        className={[
          'flex h-full w-full items-center justify-center rounded-sm',
          PADDING[density],
          // One step above the InformationBar's text-sm. The bar is reference
          // material you scan between corners; this is meant to be caught
          // peripherally mid-corner, so it takes the bar's padding and weight
          // but not quite its size. Bold for the same reason: unlike a bar
          // item, this number is the whole widget.
          'text-base',
          // Easing applies to the fill only. The number below is plain text
          // with no transition, so it always reads the current held value.
          'transition-colors duration-100 ease-out',
        ].join(' ')}
        style={{
          backgroundColor: `rgb(${isFaster ? FASTER_RGB : SLOWER_RGB} / ${intensity})`,
        }}
      >
        {showNumber && (
          <div className="font-bold leading-none tabular-nums text-white">
            {text}
            <span className="ml-1 text-xs font-normal text-white/70">
              {unit}
            </span>
          </div>
        )}
      </div>
    );
  }
);
DeltaSpeedBox.displayName = 'DeltaSpeedBox';
