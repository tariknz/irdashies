import { useEffect, useRef, useState } from 'react';

const FLASH_MS = 150;

/** Colour for a moment after the gear changes: upColor going up, downColor going down. */
export const useGearFlash = (
  gear: number | undefined,
  enabled: boolean,
  upColor: string,
  downColor: string
) => {
  const prev = useRef(gear);
  const [color, setColor] = useState<string>();

  useEffect(() => {
    const was = prev.current;
    prev.current = gear;
    // Neutral/reverse (<1) are skipped so pit entry and launch don't flash.
    if (!enabled || gear === undefined || was === undefined) return;
    if (gear < 1 || was < 1 || gear === was) return;
    setColor(gear > was ? upColor : downColor);
    const t = setTimeout(() => setColor(undefined), FLASH_MS);
    return () => clearTimeout(t);
  }, [gear, enabled, upColor, downColor]);

  return enabled ? color : undefined;
};
