import { useEffect, useState, memo, useMemo, useCallback } from 'react';
import type { CarData } from '../../../utils/carData';
import type { ShiftPointSettings } from '../../Settings/types';

interface TachometerProps {
  rpm: number;
  maxRpm: number;
  /** Current gear */
  gear?: number;
  /** RPM when LEDs should turn purple (shift point) */
  shiftRpm?: number;
  /** RPM when LEDs should start blinking */
  blinkRpm?: number;
  /** Number of LED lights to display (default: 10) */
  numLights?: number;
  /** Size of each LED light in pixels (default: 20) */
  ledSize?: number;
  /** Whether to show RPM text display (default: true) */
  showRpmText?: boolean;
  /** Car-specific RPM thresholds for each LED */
  gearRpmThresholds?: number[] | null;
  /** Car-specific LED colors */
  ledColors?: string[] | null;
  /** Car data for LED count */
  carData?: CarData | null;
  /** CarPath from iRacing session (for custom shift points) */
  carPath?: string;
  /** Custom shift point settings */
  shiftPointSettings?: ShiftPointSettings;
}

export const Tachometer = memo(
  ({
    rpm,
    maxRpm,
    gear = 0,
    shiftRpm = 0, // Optional shift RPM (DriverCarSLShiftRPM)
    blinkRpm = 0, // Optional blink RPM (DriverCarSLBlinkRPM)
    numLights = 10,
    ledSize = 20,
    showRpmText = true,
    gearRpmThresholds = null,
    ledColors = null,
    carData = null,
    carPath = undefined,
    shiftPointSettings = undefined,
  }: TachometerProps) => {
    const [flash, setFlash] = useState(false);
    const [customShiftFlash, setCustomShiftFlash] = useState(false);

    // Ensure RPM is within valid range
    const clampedRpm = Math.max(0, Math.min(rpm || 0, maxRpm));

    // Memoize basic configurations
    const { effectiveShiftRpm, effectiveBlinkRpm, effectiveNumLights } =
      useMemo(
        () => ({
          effectiveShiftRpm: gearRpmThresholds
            ? gearRpmThresholds[0]
            : shiftRpm || maxRpm * 0.9,
          effectiveBlinkRpm: gearRpmThresholds
            ? gearRpmThresholds[0]
            : blinkRpm || maxRpm * 0.97,
          effectiveNumLights:
            carData?.ledNumber ||
            (ledColors ? ledColors.length - 1 : numLights),
        }),
        [
          gearRpmThresholds,
          shiftRpm,
          blinkRpm,
          maxRpm,
          carData?.ledNumber,
          ledColors,
          numLights,
        ]
      );

    // Custom shift point logic - memoized
    const {
      shouldShowCustomShift,
      indicatorType,
      indicatorColor,
      hasCustomShiftPoints,
    } = useMemo(() => {
      const carConfig = carPath && shiftPointSettings?.carConfigs[carPath];
      const customShiftPoint =
        carConfig && typeof carConfig !== 'string'
          ? carConfig.gearShiftPoints[gear.toString()]?.shiftRpm
          : undefined;
      const shouldShowCustomShift = !!(
        shiftPointSettings?.enabled &&
        customShiftPoint &&
        clampedRpm >= customShiftPoint &&
        gear > 0
      );
      const indicatorType = shiftPointSettings?.indicatorType || 'glow';
      const indicatorColor = shiftPointSettings?.indicatorColor || '#00ff00';
      const hasCustomShiftPoints = !!(
        shiftPointSettings?.enabled &&
        carConfig &&
        typeof carConfig !== 'string'
      );
      return {
        shouldShowCustomShift,
        indicatorType,
        indicatorColor,
        hasCustomShiftPoints,
      };
    }, [carPath, shiftPointSettings, gear, clampedRpm]);

    // Calculate activation thresholds for each light - memoized function
    const getActivationThreshold = useCallback(
      (ledIndex: number) => {
        if (gearRpmThresholds && gearRpmThresholds[ledIndex + 1]) {
          return gearRpmThresholds[ledIndex + 1];
        }

        const lastLedIndex = effectiveNumLights - 1;
        const secondLastIndex = effectiveNumLights - 2;
        const thirdLastIndex = effectiveNumLights - 3;

        if (ledIndex === lastLedIndex) {
          return effectiveShiftRpm * 0.9;
        } else if (ledIndex === secondLastIndex) {
          return effectiveShiftRpm * 0.85;
        } else if (ledIndex === thirdLastIndex) {
          return effectiveShiftRpm * 0.8;
        }

        const normalizedIndex = ledIndex / (effectiveNumLights - 3);
        return effectiveShiftRpm * 0.75 * normalizedIndex;
      },
      [gearRpmThresholds, effectiveNumLights, effectiveShiftRpm]
    );

    // Calculate how many LEDs should be active - memoized
    const activeLights = useMemo(() => {
      if (clampedRpm <= 0) return 0;
      if (clampedRpm >= effectiveShiftRpm) return effectiveNumLights;

      if (gearRpmThresholds && gearRpmThresholds.length > 1) {
        let activeCount = 0;
        for (
          let i = 1;
          i < gearRpmThresholds.length && i <= effectiveNumLights;
          i++
        ) {
          if (clampedRpm >= gearRpmThresholds[i]) {
            activeCount++;
          }
        }
        return activeCount;
      }

      let activeCount = 0;
      for (let i = 0; i < effectiveNumLights; i++) {
        if (clampedRpm >= getActivationThreshold(i)) {
          activeCount = i + 1;
        }
      }
      return activeCount;
    }, [
      clampedRpm,
      effectiveShiftRpm,
      effectiveNumLights,
      gearRpmThresholds,
      getActivationThreshold,
    ]);

    // Determine if a specific LED should be active - memoized
    const isLedActive = useCallback(
      (ledIndex: number): boolean => {
        if (!gearRpmThresholds || gearRpmThresholds.length <= 1) {
          return ledIndex < activeLights;
        }

        const thresholdIndex = ledIndex + 1;
        if (thresholdIndex < gearRpmThresholds.length) {
          return clampedRpm >= gearRpmThresholds[thresholdIndex];
        }
        return false;
      },
      [gearRpmThresholds, activeLights, clampedRpm]
    );

    // Get custom shift indicator style for RPM text box - memoized
    const rpmBoxStyle = useMemo(() => {
      if (!shouldShowCustomShift) return {};

      const baseStyle = { transition: 'all 0.2s ease' };

      switch (indicatorType) {
        case 'glow':
          return {
            ...baseStyle,
            boxShadow: `0 0 20px ${indicatorColor}, 0 0 40px ${indicatorColor}`,
            backgroundColor: indicatorColor,
            color: '#000000',
            border: `2px solid ${indicatorColor}`,
          };
        case 'border':
          return {
            ...baseStyle,
            boxShadow: `0 0 15px ${indicatorColor}`,
            border: `3px solid ${indicatorColor}`,
            backgroundColor: 'rgba(0,0,0,0.8)',
          };
        case 'pulse':
          return {
            ...baseStyle,
            boxShadow: `0 0 15px ${indicatorColor}`,
            backgroundColor: customShiftFlash
              ? indicatorColor
              : 'rgba(0,0,0,0.8)',
            color: customShiftFlash ? '#000000' : '#ffffff',
            border: `2px solid ${indicatorColor}`,
          };
        default:
          return baseStyle;
      }
    }, [
      shouldShowCustomShift,
      indicatorType,
      indicatorColor,
      customShiftFlash,
    ]);

    const shouldShowRpmBox = showRpmText || hasCustomShiftPoints;

    // Flash effects
    useEffect(() => {
      if (clampedRpm >= effectiveBlinkRpm) {
        const interval = setInterval(() => setFlash((prev) => !prev), 200);
        return () => {
          clearInterval(interval);
          setFlash(false);
        };
      }
    }, [clampedRpm, effectiveBlinkRpm]);

    useEffect(() => {
      if (shouldShowCustomShift && indicatorType === 'pulse') {
        const interval = setInterval(
          () => setCustomShiftFlash((prev) => !prev),
          500
        );
        return () => {
          clearInterval(interval);
          setCustomShiftFlash(false);
        };
      }
    }, [shouldShowCustomShift, indicatorType]);

    // Determine LED colors for all lights - memoized to prevent per-render iteration in JSX
    const ledStyles = useMemo(() => {
      return Array.from({ length: effectiveNumLights }, (_, index) => {
        let color = '#1f2937'; // Inactive
        const isActive = isLedActive(index);

        if (isActive) {
          if (clampedRpm >= effectiveBlinkRpm) {
            color = flash ? '#ffffff' : '#9333ea';
          } else if (clampedRpm >= effectiveShiftRpm) {
            color = '#a855f7';
          } else if (ledColors && ledColors[index + 1]) {
            const argb = ledColors[index + 1];
            color =
              argb.length === 9 && argb.startsWith('#FF')
                ? '#' + argb.slice(3)
                : argb;
          } else {
            const last = effectiveNumLights - 1;
            const secondLast = effectiveNumLights - 2;
            const thirdLast = effectiveNumLights - 3;
            if (index === last) color = '#ef4444';
            else if (index === secondLast || index === thirdLast)
              color = '#eab308';
            else color = '#22c55e';
          }
        }

        return {
          backgroundColor: color,
          boxShadow: isActive ? `0 0 4px ${color}` : 'none',
          width: ledSize,
          height: ledSize,
        };
      });
    }, [
      effectiveNumLights,
      isLedActive,
      clampedRpm,
      effectiveBlinkRpm,
      flash,
      effectiveShiftRpm,
      ledColors,
      ledSize,
    ]);

    return (
      <div className="flex items-center gap-1 p-2 rounded">
        <div className="flex gap-1">
          {ledStyles.map((style, i) => (
            <div
              key={i}
              className="rounded-full border border-gray-600 transition-all duration-300"
              style={style}
              aria-label={`LED ${i + 1}`}
            />
          ))}
        </div>

        {shouldShowRpmBox && (
          <div
            className="ml-3 text-sm font-mono font-bold text-white bg-black/50 px-2 rounded transition-all duration-200 whitespace-nowrap flex items-center"
            style={{
              ...rpmBoxStyle,
              minWidth: showRpmText ? '120px' : '60px',
              height: '32px',
            }}
          >
            {showRpmText && (
              <>
                {Math.round(clampedRpm).toLocaleString('en-US')}
                <span className="text-xs text-gray-300 ml-1">RPM</span>
                {shouldShowCustomShift && (
                  <span className="text-xs ml-2 font-bold">SHIFT</span>
                )}
              </>
            )}
            {!showRpmText && shouldShowCustomShift && (
              <span className="text-xs font-bold">SHIFT</span>
            )}
          </div>
        )}
      </div>
    );
  }
);

Tachometer.displayName = 'Tachometer';
