import { useEffect, useMemo, useState } from 'react';
import {
  useDashboard,
  useDriverControlsSnapshot,
  useSessionStore,
} from '@irdashies/context';
import { getGearKey, loadCarData } from '@irdashies/utils/carData';
import type { ShiftPointSettings } from '@irdashies/types';
import {
  getCustomShiftRpm,
  getRedlineFlashRpm,
  getShiftFlashRpm,
  isShiftFlashActive,
  type ShiftFlashSource,
} from './shiftLight';

const FALLBACK_REDLINE_RPM = 7500;

/** Custom shift points are owned by the Tachometer settings. */
export const useShiftPointSettings = (): ShiftPointSettings | undefined => {
  const { currentDashboard } = useDashboard();
  const config = currentDashboard?.widgets.find((w) => w.id === 'tachometer')
    ?.config as { shiftPointSettings?: ShiftPointSettings } | undefined;
  return config?.shiftPointSettings;
};

/**
 * True while the player's RPM is at or above the flash threshold: the
 * redline, or the Tachometer custom shift point for this car and gear.
 */
export const useShiftFlashActive = (
  enabled: boolean,
  source: ShiftFlashSource
): boolean => {
  const snapshot = useDriverControlsSnapshot(enabled);
  const shiftPointSettings = useShiftPointSettings();
  const driverCarRedLine = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarRedLine
  );
  const carPath = useSessionStore((state) => {
    const idx = state.session?.DriverInfo?.DriverCarIdx;
    if (idx === undefined) return undefined;
    return state.session?.DriverInfo?.Drivers?.find((d) => d.CarIdx === idx)
      ?.CarPath;
  });
  const carData = useMemo(
    () => (enabled && carPath ? loadCarData(carPath) : null),
    [enabled, carPath]
  );

  if (!enabled || !snapshot) return false;

  const rpm = snapshot.rpm ?? 0;
  const gear = snapshot.gear ?? 0;
  const shiftGrindRpm = snapshot.shiftGrindRpm ?? 0;
  const maxRpm =
    driverCarRedLine ||
    (shiftGrindRpm > 0 ? shiftGrindRpm : null) ||
    FALLBACK_REDLINE_RPM;
  const gearRedlineRpm = carData?.ledRpm?.[0]?.[getGearKey(gear)]?.[0];

  const threshold = getShiftFlashRpm(
    source,
    getCustomShiftRpm(shiftPointSettings, carData?.carId ?? carPath, gear),
    getRedlineFlashRpm(maxRpm, snapshot.blinkRpm ?? 0, gearRedlineRpm)
  );

  return isShiftFlashActive(rpm, threshold);
};

/**
 * Toggles every intervalMs while active, starting in the on state so the
 * first flash is immediate. False when inactive.
 */
export const useBlink = (active: boolean, intervalMs = 200): boolean => {
  const [off, setOff] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setOff((prev) => !prev), intervalMs);
    return () => {
      clearInterval(id);
      setOff(false);
    };
  }, [active, intervalMs]);

  return active && !off;
};
