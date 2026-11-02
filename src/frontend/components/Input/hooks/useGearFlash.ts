import { useEffect, useRef, useState } from 'react';

const FLASH_MS = 250;

/** Colour for a moment after the gear changes: upColor going up, downColor going down. */
export const useGearFlash = (
  gear: number | undefined,
  enabled: boolean,
  upColor: string,
  downColor: string
) => {
  // Last forward gear: a shift passing through neutral (3 -> N -> 4) still counts.
  const prev = useRef(gear);
  // A new object per shift, so a second shift inside the window restarts the timer.
  const [flash, setFlash] = useState<{ up: boolean }>();

  useEffect(() => {
    // Undefined means a session boundary: forget the baseline so the new grid doesn't flash.
    if (gear === undefined) prev.current = undefined;
    // Neutral/reverse (<1) are not a shift, so pit entry and launch don't flash.
    if (gear === undefined || gear < 1) {
      setFlash(undefined);
      return;
    }
    const was = prev.current;
    prev.current = gear;
    if (!enabled) setFlash(undefined);
    if (!enabled || was === undefined || was < 1 || gear === was) return;
    setFlash({ up: gear > was });
  }, [gear, enabled]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(undefined), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  if (!enabled || !flash) return undefined;
  return flash.up ? upColor : downColor;
};
