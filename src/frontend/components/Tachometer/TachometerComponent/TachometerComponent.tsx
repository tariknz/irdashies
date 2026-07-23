import { memo, useEffect, useMemo, useState } from 'react';
import { EngineWarnings } from '@irdashies/types';
import type { CarData } from '../../../utils/carData';
import {
  clampRpm,
  isLedActive,
  resolveLedColor,
  resolveLedCount,
  resolveThresholds,
} from '@irdashies/domain/shiftLights/shiftLightModel';

export interface TachometerProps {
  rpm: number;
  maxRpm: number;
  engineWarnings?: number;
  shiftRpm?: number;
  blinkRpm?: number;
  numLights?: number;
  showRpmText?: boolean;
  rpmOrientation?: 'horizontal' | 'bottom' | 'top';
  gearRpmThresholds?: readonly number[] | null;
  ledColors?: readonly string[] | null;
  carData?: CarData | null;
  opacity?: number;
  oilTemp?: number;
  waterTemp?: number;
  showOilTemp?: boolean;
  showWaterTemp?: boolean;
  oilTempPosition?: 'top' | 'bottom';
  waterTempPosition?: 'top' | 'bottom';
  swapTempSides?: boolean;
  oilEdgeOffset?: number;
  waterEdgeOffset?: number;
}

interface TemperatureBoxProps {
  label: string;
  value: number;
  warning: boolean;
  position: 'top' | 'bottom';
  side: 'left' | 'right';
  offset: number;
  opacity: number;
}

const TemperatureBox = memo(
  ({
    label,
    value,
    warning,
    position,
    side,
    offset,
    opacity,
  }: TemperatureBoxProps) => {
    const edge = `${6 + (Math.max(0, Math.min(100, offset)) / 100) * 32}%`;
    return (
      <div
        className={`absolute ${position === 'top' ? 'top-0' : 'bottom-0'} bg-slate-800/(--bg-opacity) flex h-[1.5em] min-w-[5em] items-center justify-center gap-1 rounded-lg px-4 font-mono text-2xl font-bold whitespace-nowrap ${warning ? 'text-red-500' : 'text-white'}`}
        style={{ ['--bg-opacity' as string]: `${opacity}%`, [side]: edge }}
      >
        <span className="text-[0.7em] text-gray-400">{label}</span>
        <span>{Math.round(value)}°C</span>
      </div>
    );
  }
);
TemperatureBox.displayName = 'TemperatureBox';

export const Tachometer = ({
  rpm,
  maxRpm,
  engineWarnings = 0,
  shiftRpm = 0,
  blinkRpm = 0,
  numLights = 10,
  showRpmText = true,
  rpmOrientation = 'bottom',
  gearRpmThresholds = null,
  ledColors = null,
  carData = null,
  opacity = 80,
  oilTemp = 0,
  waterTemp = 0,
  showOilTemp = true,
  showWaterTemp = true,
  oilTempPosition = 'top',
  waterTempPosition = 'top',
  swapTempSides = false,
  oilEdgeOffset = 0,
  waterEdgeOffset = 0,
}: TachometerProps) => {
  const clampedRpm = clampRpm(rpm, maxRpm);
  const thresholds = resolveThresholds(
    maxRpm,
    shiftRpm,
    blinkRpm,
    gearRpmThresholds
  );
  const ledCount = resolveLedCount(carData?.ledNumber ?? numLights, ledColors);
  const shouldBlink = clampedRpm >= thresholds.blink;
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!shouldBlink) {
      setFlash(false);
      return;
    }
    const interval = window.setInterval(() => setFlash((value) => !value), 200);
    return () => window.clearInterval(interval);
  }, [shouldBlink]);

  const leds = useMemo(
    () =>
      Array.from({ length: ledCount }, (_, index) => {
        const active = isLedActive(
          index,
          ledCount,
          clampedRpm,
          thresholds.shift,
          gearRpmThresholds
        );
        return {
          active,
          color: resolveLedColor({
            index,
            ledCount,
            active,
            rpm: clampedRpm,
            shiftRpm: thresholds.shift,
            blinkRpm: thresholds.blink,
            flash,
            ledColors,
          }),
        };
      }),
    [
      clampedRpm,
      flash,
      gearRpmThresholds,
      ledColors,
      ledCount,
      thresholds.blink,
      thresholds.shift,
    ]
  );

  const horizontal = rpmOrientation === 'horizontal';
  const rpmFirst = rpmOrientation === 'top';
  const ledWidth = `min(80cqh, ${(85 / ledCount).toFixed(2)}cqw)`;
  const oilWarning = Boolean(engineWarnings & EngineWarnings.OilTempWarning);
  const waterWarning = Boolean(
    engineWarnings & EngineWarnings.WaterTempWarning
  );

  const rpmBox = showRpmText ? (
    <div
      id="rpm-text"
      className="bg-slate-800/(--bg-opacity) flex h-[1.5em] min-w-[6em] shrink-0 items-center justify-center rounded-lg px-4 font-mono text-2xl font-bold text-white whitespace-nowrap"
      style={{ ['--bg-opacity' as string]: `${opacity}%` }}
    >
      {Math.round(clampedRpm).toLocaleString('en-US')}
      <span className="ml-2 text-[0.6em]">RPM</span>
    </div>
  ) : null;

  const ledBar = (
    <div
      id="ledcontainer"
      className="bg-slate-800/(--bg-opacity) flex items-center justify-center rounded-full"
      style={{
        ['--bg-opacity' as string]: `${opacity}%`,
        padding: `4px min(40cqh, ${(42.5 / ledCount).toFixed(2)}cqw)`,
      }}
    >
      {leds.map((led, index) => (
        <div
          key={index}
          className="aspect-square p-0.5"
          style={{ width: ledWidth }}
        >
          <div
            aria-label={`LED ${index + 1}`}
            className="h-full w-full rounded-full border border-gray-600 transition-all duration-300"
            style={{
              backgroundColor: led.color,
              boxShadow: led.active ? `0 0 4px ${led.color}` : 'none',
            }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="@container-[size] relative flex h-full w-full items-center justify-center">
      {showOilTemp && (
        <TemperatureBox
          label="OIL"
          value={oilTemp}
          warning={oilWarning}
          position={oilTempPosition}
          side={swapTempSides ? 'right' : 'left'}
          offset={oilEdgeOffset}
          opacity={opacity}
        />
      )}
      {showWaterTemp && (
        <TemperatureBox
          label="H₂O"
          value={waterTemp}
          warning={waterWarning}
          position={waterTempPosition}
          side={swapTempSides ? 'left' : 'right'}
          offset={waterEdgeOffset}
          opacity={opacity}
        />
      )}
      <div
        className={`flex items-center justify-center gap-2 ${horizontal ? 'flex-row' : rpmFirst ? 'flex-col-reverse' : 'flex-col'}`}
      >
        {ledBar}
        {rpmBox}
      </div>
    </div>
  );
};
