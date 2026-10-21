import { useEffect, useState } from 'react';
import type { CarData } from '@irdashies/utils/carData';
import type { ShiftPointSettings } from '@irdashies/types';
import { useCustomShiftPoints } from '../hooks/useCustomShiftPoints';

export interface ShiftLightProps {
  rpm: number;
  maxRpm: number;
  /** iRacing shift threshold; falls back to 90% of redline. */
  shiftRpm?: number;
  /** Current gear */
  gear?: number;
  /** Whether to show RPM text display (default: true) */
  showRpmText?: boolean;
  /** Canonical car data for custom shift point lookup */
  carData?: CarData | null;
  /** CarPath from iRacing session (for custom shift points) */
  carPath?: string;
  /** Custom shift point settings */
  shiftPointSettings?: ShiftPointSettings;
  /** Background opacity */
  opacity?: number;
}

export const ShiftLight = ({
  rpm,
  maxRpm,
  shiftRpm = 0,
  gear = 0,
  showRpmText = true,
  carData = null,
  carPath = undefined,
  shiftPointSettings = undefined,
  opacity = 100,
}: ShiftLightProps) => {
  const [customShiftFlash, setCustomShiftFlash] = useState(false);

  // Ensure RPM is within valid range
  const clampedRpm = Math.max(0, Math.min(rpm || 0, maxRpm));

  const {
    shouldShowShiftIndicator: shouldShowCustomShift,
    indicatorType,
    indicatorColor,
    carConfig,
  } = useCustomShiftPoints(
    shiftPointSettings,
    carPath,
    gear,
    clampedRpm,
    carData
  );

  const automaticShiftRpm = shiftRpm > 0 ? shiftRpm : maxRpm * 0.9;
  const shouldShowShift = shiftPointSettings?.enabled
    ? shouldShowCustomShift
    : gear > 0 && automaticShiftRpm > 0 && rpm >= automaticShiftRpm;

  // Get custom shift indicator style for RPM text box
  const getRpmBoxStyle = () => {
    if (!shouldShowShift) return {};

    const baseStyle = {
      transition: 'all 0.2s ease',
    };

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
  };

  // Determine if RPM box should be shown - always show when custom shift points are configured
  const shouldShowRpmBox =
    showRpmText ||
    shouldShowShift ||
    !!(shiftPointSettings?.enabled && carConfig?.enabled);

  // Custom shift point flash effect
  useEffect(() => {
    if (shouldShowShift && indicatorType === 'pulse') {
      const interval = setInterval(() => {
        setCustomShiftFlash((prevFlash) => !prevFlash);
      }, 100);
      return () => {
        clearInterval(interval);
        setCustomShiftFlash(false);
      };
    }
  }, [shouldShowShift, indicatorType]);

  return (
    <div
      className={`@container-[size] flex  justify-center items-center w-full h-full gap-2`}
    >
      {shouldShowRpmBox && (
        <div
          data-testid="shiftlight-box"
          className={`bg-slate-800/(--bg-opacity) flex relative items-center justify-center rounded-lg`}
          style={{
            ['--bg-opacity' as string]: `${opacity ?? 80}%`,
            padding: `1px`,
          }}
        >
          {/* ShiftPoint/RPM display - shows when showRpmText is true OR when custom shift points exist */}

          <div
            id="rpm-text"
            className={`bg-slate-800/(--bg-opacity) text-2xl flex relative font-mono font-bold text-white px-4 mx-2 rounded-lg transition-colors duration-200 whitespace-nowrap justify-center items-center`}
            style={{
              ...getRpmBoxStyle(),
              height: '3em',
              ['--bg-opacity' as string]: `${opacity ?? 80}%`,
              padding: `1px`,
            }}
          >
            {showRpmText && (
              <>
                {shouldShowShift ? (
                  <span className="font-bold text-[2em]">SHIFT</span>
                ) : (
                  <>
                    {Math.round(clampedRpm).toLocaleString('en-US')}
                    <span className="text-[0.6em] ml-2">RPM</span>
                  </>
                )}
              </>
            )}
            {!showRpmText && shouldShowShift && (
              <span className="font-bold text-[2em]">SHIFT</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
