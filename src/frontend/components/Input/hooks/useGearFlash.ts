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
  const [up, setUp] = useState<boolean>();

  useEffect(() => {
    // Neutral/reverse (<1) are not a shift, so pit entry and launch don't flash.
    if (gear === undefined || gear < 1) return;
    const was = prev.current;
    prev.current = gear;
    if (!enabled || was === undefined || was < 1 || gear === was) return;
    setUp(gear > was);
    const t = setTimeout(() => setUp(undefined), FLASH_MS);
    return () => clearTimeout(t);
  }, [gear, enabled]);

  if (!enabled || up === undefined) return undefined;
  return up ? upColor : downColor;
};
