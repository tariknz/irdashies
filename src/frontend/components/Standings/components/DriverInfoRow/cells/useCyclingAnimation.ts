import { useLayoutEffect } from 'react';

// Shared timestamp per animation frame — all components in the same ~16ms
// window get the exact same Date.now(), eliminating per-component phase spread.
let _syncFrame = -1;
let _syncNow = 0;

export function syncedNow(): number {
  if (typeof performance === 'undefined') return Date.now();
  const f = Math.floor(performance.now() / 16);
  if (f !== _syncFrame) {
    _syncFrame = f;
    _syncNow = Date.now();
  }
  return _syncNow;
}

/**
 * Builds WAAPI keyframes for an item at index `itemIndex` out of `totalItems`.
 * Each item is visible for 1/N of the duration.
 * When becoming visible, it slides up from below.
 * When becoming invisible, it slides up out of view.
 */
export function buildCyclingKeyframes(
  itemIndex: number,
  totalItems: number
): Keyframe[] {
  if (totalItems <= 1) return [];

  const sliceSize = 1 / totalItems;
  const start = itemIndex * sliceSize;
  const end = (itemIndex + 1) * sliceSize;
  const margin = Math.min(0.05, sliceSize * 0.1);

  // SEAMLESS PUSH LOGIC:
  // Item i slides OUT at [end - margin, end]
  // Item i+1 slides IN at [start - margin (i.e. end_of_i - margin), start (i.e. end_of_i)]
  // This creates a perfect "push" where one moves up as the other follows from below.

  // To fix the loop-back gap, Item 0 slides IN during [1 - margin, 1].
  // Since 1.0 is the same as 0.0 in a looping animation, Item 0 is at its
  // "Visible" (0%) position for the entire [0, end - margin] window.

  if (itemIndex === 0) {
    return [
      // Visible (Hold)
      { transform: 'translateY(0)', opacity: 1, offset: 0 },
      {
        transform: 'translateY(0)',
        opacity: 1,
        offset: Math.max(0, end - margin),
      },
      // Slide Out (Top)
      { transform: 'translateY(-105%)', opacity: 1, offset: end },
      // Stay Up (Hidden while others rotate)
      {
        transform: 'translateY(-105%)',
        opacity: 0,
        offset: Math.min(1, end + 0.001),
      },
      {
        transform: 'translateY(-105%)',
        opacity: 0,
        offset: Math.max(0, 1 - margin - 0.001),
      },
      // Jump to Bottom (Hidden)
      {
        transform: 'translateY(105%)',
        opacity: 0,
        offset: Math.max(0, 1 - margin),
      },
      // Slide In (Enter from Bottom to 0% at offset 1)
      {
        transform: 'translateY(105%)',
        opacity: 1,
        offset: Math.max(0, 1 - margin + 0.001),
      },
      { transform: 'translateY(0)', opacity: 1, offset: 1 },
    ];
  }

  return [
    // Stay Below (Hidden while previous rotate)
    { transform: 'translateY(105%)', opacity: 0, offset: 0 },
    {
      transform: 'translateY(105%)',
      opacity: 0,
      offset: Math.max(0, start - margin - 0.001),
    },
    // Slide In (Bottom to 0%)
    {
      transform: 'translateY(105%)',
      opacity: 1,
      offset: Math.max(0, start - margin),
    },
    { transform: 'translateY(0)', opacity: 1, offset: start },
    // Visible (Hold)
    {
      transform: 'translateY(0)',
      opacity: 1,
      offset: Math.max(start, end - margin),
    },
    // Slide Out (Top)
    { transform: 'translateY(-105%)', opacity: 1, offset: end },
    // Stay Up (Hidden)
    {
      transform: 'translateY(-105%)',
      opacity: 0,
      offset: Math.min(1, end + 0.001),
    },
    { transform: 'translateY(-105%)', opacity: 0, offset: 1 },
  ];
}

/**
 * Hook to apply synced cycling animations to a set of refs.
 */
export function useCyclingAnimation(
  refs: React.RefObject<HTMLElement | null>[],
  frequencyMs: number,
  enabled: boolean
) {
  useLayoutEffect(() => {
    if (!enabled || refs.length <= 1) return;

    const animations: Animation[] = [];

    refs.forEach((ref, index) => {
      const el = ref.current;
      if (!el || typeof el.animate !== 'function') return;

      const keyframes = buildCyclingKeyframes(index, refs.length);
      const anim = el.animate(keyframes, {
        duration: frequencyMs,
        iterations: Infinity,
        fill: 'both',
      });

      const phase = syncedNow() % frequencyMs;
      anim.currentTime = phase;
      animations.push(anim);
    });

    return () => {
      animations.forEach((anim) => anim.cancel());
    };
  }, [enabled, frequencyMs, refs]);
}
