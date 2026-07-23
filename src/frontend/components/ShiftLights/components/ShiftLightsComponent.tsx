import { memo, useEffect, useMemo, useState } from 'react';
import type { ShiftPointSettings } from '@irdashies/types';
import { resolveCustomShiftPoint } from '@irdashies/domain/shiftLights/shiftLightModel';

export interface ShiftLightsComponentProps {
  rpm: number;
  gear: number;
  carId?: string;
  carPath?: string;
  shiftPointSettings?: ShiftPointSettings;
  opacity?: number;
}

export const ShiftLightsComponent = memo(
  ({
    rpm,
    gear,
    carId,
    carPath,
    shiftPointSettings,
    opacity = 80,
  }: ShiftLightsComponentProps) => {
    const shiftPoint = resolveCustomShiftPoint(
      shiftPointSettings,
      carPath,
      carId,
      gear
    );
    const visible = shiftPoint !== undefined && rpm >= shiftPoint;
    const indicatorType = shiftPointSettings?.indicatorType ?? 'glow';
    const indicatorColor = shiftPointSettings?.indicatorColor ?? '#00ff00';
    const [flash, setFlash] = useState(false);

    useEffect(() => {
      if (!visible || indicatorType !== 'pulse') {
        setFlash(false);
        return;
      }
      const interval = window.setInterval(
        () => setFlash((value) => !value),
        500
      );
      return () => window.clearInterval(interval);
    }, [indicatorType, visible]);

    const style = useMemo(() => {
      const base = { borderColor: indicatorColor };
      if (indicatorType === 'border') {
        return { ...base, boxShadow: `0 0 15px ${indicatorColor}` };
      }
      if (indicatorType === 'pulse') {
        return {
          ...base,
          backgroundColor: flash ? indicatorColor : undefined,
          color: flash ? '#000000' : undefined,
          boxShadow: `0 0 15px ${indicatorColor}`,
        };
      }
      return {
        ...base,
        backgroundColor: indicatorColor,
        color: '#000000',
        boxShadow: `0 0 20px ${indicatorColor}, 0 0 40px ${indicatorColor}`,
      };
    }, [flash, indicatorColor, indicatorType]);

    if (!visible) return null;

    return (
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="bg-slate-800/(--bg-opacity) flex h-full max-h-[2.5em] min-h-[1.5em] w-full min-w-[5em] items-center justify-center rounded-lg border-2 px-4 font-mono text-2xl font-bold text-white transition-all duration-200"
          style={{ ...style, ['--bg-opacity' as string]: `${opacity}%` }}
        >
          SHIFT
        </div>
      </div>
    );
  }
);
ShiftLightsComponent.displayName = 'ShiftLightsComponent';
