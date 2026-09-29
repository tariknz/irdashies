import { useEffect, useRef, useState } from 'react';
import { advanceFade } from '../radarFade';

/**
 * Opacity for the radar panel, ramped towards `active` over `fadeSeconds`.
 *
 * The clock only runs while the opacity is still moving, so a settled radar
 * costs nothing per frame. The current value is held in a ref as well as in
 * state: a target that flips mid-fade has to continue from where the fade got
 * to, not from the value React last rendered.
 */
export const useRadarFade = (active: boolean, fadeSeconds: number): number => {
  const target = active ? 1 : 0;
  const [opacity, setOpacity] = useState(target);
  const opacityRef = useRef(opacity);

  useEffect(() => {
    if (fadeSeconds <= 0) {
      opacityRef.current = target;
      setOpacity(target);
      return;
    }
    if (opacityRef.current === target) return;

    let frame = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const next = advanceFade(
        opacityRef.current,
        target,
        (now - last) / 1000,
        fadeSeconds
      );
      last = now;
      opacityRef.current = next;
      setOpacity(next);
      if (next !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, fadeSeconds]);

  return opacity;
};
