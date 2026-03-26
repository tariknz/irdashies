import { memo, useRef, useLayoutEffect } from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { DriverStatusBadges } from './DriverStatusBadges';
import {
  DriverName as formatDriverName,
  extractDriverName,
  type DriverNameFormat,
} from '../../DriverName/DriverName';

// Shared timestamp per animation frame — all components in the same ~16ms
// window get the exact same Date.now(), eliminating per-component phase spread.
let _syncFrame = -1;
let _syncNow = 0;
function syncedNow(): number {
  if (typeof performance === 'undefined') return Date.now();
  const f = Math.floor(performance.now() / 16);
  if (f !== _syncFrame) {
    _syncFrame = f;
    _syncNow = Date.now();
  }
  return _syncNow;
}

// WAAPI keyframes — replicate CSS name-slide-primary/secondary.
// Per-keyframe easing matches CSS `animation-timing-function: ease-in-out`.
const primaryKeyframes: Keyframe[] = [
  { transform: 'translateY(0)', opacity: 1, offset: 0, easing: 'ease-in-out' },
  {
    transform: 'translateY(0)',
    opacity: 1,
    offset: 0.4,
    easing: 'ease-in-out',
  },
  {
    transform: 'translateY(-110%)',
    opacity: 0,
    offset: 0.5,
    easing: 'ease-in-out',
  },
  {
    transform: 'translateY(-110%)',
    opacity: 0,
    offset: 0.9,
    easing: 'ease-in-out',
  },
  { transform: 'translateY(0)', opacity: 1, offset: 1.0 },
];

const secondaryKeyframes: Keyframe[] = [
  {
    transform: 'translateY(110%)',
    opacity: 0,
    offset: 0,
    easing: 'ease-in-out',
  },
  {
    transform: 'translateY(110%)',
    opacity: 0,
    offset: 0.4,
    easing: 'ease-in-out',
  },
  {
    transform: 'translateY(0)',
    opacity: 1,
    offset: 0.5,
    easing: 'ease-in-out',
  },
  {
    transform: 'translateY(0)',
    opacity: 1,
    offset: 0.9,
    easing: 'ease-in-out',
  },
  { transform: 'translateY(110%)', opacity: 0, offset: 1.0 },
];

interface DriverNameCellProps {
  name?: string;
  fullName?: string;
  nameFormat?: DriverNameFormat;
  radioActive?: boolean;
  repair?: boolean;
  penalty?: boolean;
  slowdown?: boolean;
  showStatusBadges?: boolean;
  isMinimalStatusBadges?: boolean;
  removeNumbersFromName?: boolean;
  label?: string;
  nameDisplay?: 'both' | 'label' | 'name';
  alternateFrequency?: number;
}

export const DriverNameCell = memo(
  ({
    name,
    fullName,
    nameFormat,
    radioActive,
    repair,
    penalty,
    slowdown,
    showStatusBadges = true,
    isMinimalStatusBadges = false,
    removeNumbersFromName = false,
    label,
    nameDisplay,
    alternateFrequency,
  }: DriverNameCellProps) => {
    const displayName = fullName
      ? formatDriverName(
          extractDriverName(fullName, removeNumbersFromName),
          nameFormat ?? 'name-middlename-surname'
        )
      : (name ?? '');

    const shouldAnimate = !!label && (!nameDisplay || nameDisplay === 'both');
    const staticText = nameDisplay === 'label' && label ? label : displayName;
    const freq = alternateFrequency ?? 5;
    const spanPrimaryRef = useRef<HTMLSpanElement>(null);
    const spanSecondaryRef = useRef<HTMLSpanElement>(null);

    // Create WAAPI animations directly and sync to global clock.
    // useLayoutEffect ensures animations are created and seeked BEFORE the
    // first paint — no flash of unstyled/overlapping text.
    // syncedNow() guarantees all components in the same frame get identical phase.
    useLayoutEffect(() => {
      if (!shouldAnimate) return;
      const el1 = spanPrimaryRef.current;
      const el2 = spanSecondaryRef.current;
      if (!el1 || !el2) return;
      if (typeof el1.animate !== 'function') return;

      const freqMs = freq * 1000;
      const opts: KeyframeAnimationOptions = {
        duration: freqMs,
        iterations: Infinity,
      };

      const anim1 = el1.animate(primaryKeyframes, opts);
      const anim2 = el2.animate(secondaryKeyframes, opts);

      const phase = syncedNow() % freqMs;
      anim1.currentTime = phase;
      anim2.currentTime = phase;

      return () => {
        anim1.cancel();
        anim2.cancel();
      };
    }, [shouldAnimate, freq, displayName]);

    return (
      <td data-column="driverName" className="w-full max-w-0 px-1 py-0.5">
        <div className="flex items-center overflow-hidden">
          <span
            className={`animate-pulse transition-[width] duration-300 ${
              radioActive ? 'w-4 mr-1' : 'w-0 overflow-hidden'
            }`}
          >
            <SpeakerHighIcon className="mt-px" size={16} />
          </span>

          <div className="flex-1 min-w-0 overflow-hidden mask-[linear-gradient(90deg,#000_90%,transparent)]">
            {shouldAnimate ? (
              <div className="relative overflow-hidden h-[1lh]">
                <span
                  ref={spanPrimaryRef}
                  className="absolute inset-0 flex items-center whitespace-nowrap"
                >
                  {displayName}
                </span>
                <span
                  ref={spanSecondaryRef}
                  className="absolute inset-0 flex items-center whitespace-nowrap"
                >
                  {label}
                </span>
              </div>
            ) : (
              <span className="block truncate">{staticText}</span>
            )}
          </div>

          {showStatusBadges && (
            <DriverStatusBadges
              repair={repair}
              penalty={penalty}
              slowdown={slowdown}
              isMinimal={isMinimalStatusBadges}
              className="shrink-0"
            />
          )}
        </div>
      </td>
    );
  }
);

DriverNameCell.displayName = 'DriverNameCell';
