import { useEffect, useState } from 'react';
import type { CarData } from '../../../utils/carData';
import type { ShiftPointSettings } from '@irdashies/types';
import { EngineWarnings } from '@irdashies/types';

export interface ShiftLightProps {
  rpm: number;
  maxRpm: number;
  engineWarnings?: number;
  /** Current gear */
  gear?: number;
  /** RPM when LEDs should turn purple (shift point) */
  shiftRpm?: number;
  /** RPM when LEDs should start blinking */
  blinkRpm?: number;
  /** Number of LED lights to display (default: 10) */
  numLights?: number;
  /** Whether to show RPM text display (default: true) */
  showRpmText?: boolean;
  /** Car-specific RPM thresholds for each LED */
  gearRpmThresholds?: number[] | null;
  /** Car data for LED count */
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
  gear = 0,
  engineWarnings = 0,
  shiftRpm = 0, // Optional shift RPM (DriverCarSLShiftRPM)
  blinkRpm = 0, // Optional blink RPM (DriverCarSLBlinkRPM)
  showRpmText = true,
  gearRpmThresholds = null,
  carData = null,
  carPath = undefined,
  shiftPointSettings = undefined,
  opacity = 100,
}: ShiftLightProps) => {
  const [flash, setFlash] = useState(false);
  const [customShiftFlash, setCustomShiftFlash] = useState(false);

  // Ensure RPM is within valid range
  const clampedRpm = Math.max(0, Math.min(rpm || 0, maxRpm));

  // Calculate effective thresholds with fallbacks
  const effectiveShiftRpm = gearRpmThresholds
    ? gearRpmThresholds[0]
    : shiftRpm || maxRpm * 0.9; // Use redline from car data
  const effectiveBlinkRpm = gearRpmThresholds
    ? gearRpmThresholds[0]
	: blinkRpm || maxRpm * 0.9; // Use redline from car data
    //: blinkRpm || maxRpm * 0.97; // Use redline from car data

  // Custom shift point logic - use CarPath from iRacing (matches lovely-car-data)
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

  // Get custom shift indicator style for RPM text box
  const getRpmBoxStyle = () => {
    if (!shouldShowCustomShift) return {};

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
          border: `inset 2px solid ${indicatorColor}`,
        };
      case 'border':
        return {
          ...baseStyle,
          boxShadow: `0 0 15px ${indicatorColor}`,
          border: `inset 3px solid ${indicatorColor}`,
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
		  //color: customShiftFlash ? '#eab308' : '#00ff00',
          border: `inset 2px solid ${indicatorColor}`,
        };
      default:
        return baseStyle;
    }
  };

  // Determine if RPM box should be shown - always show when custom shift points are configured
  const hasCustomShiftPoints = !!(
    shiftPointSettings?.enabled &&
    carConfig &&
    typeof carConfig !== 'string'
  );
  const shouldShowRpmBox = showRpmText || hasCustomShiftPoints;

  // Flash effect when RPM exceeds blink threshold
  useEffect(() => {
    // Ensure we have a valid blinkRpm
    const shouldBlink = clampedRpm >= effectiveBlinkRpm;

    if (shouldBlink) {
      // Set up flashing with a shorter interval for better visibility
      const interval = setInterval(() => {
        setFlash((prevFlash) => !prevFlash);
      }, 100); // Faster flashing - 200ms instead of 250ms

      return () => {
        clearInterval(interval);
      };
    }
  }, [clampedRpm, effectiveBlinkRpm]);

  // Custom shift point flash effect
  useEffect(() => {
    if (shouldShowCustomShift && indicatorType === 'pulse') {
      const interval = setInterval(() => {
        setCustomShiftFlash((prevFlash) => !prevFlash);
      }, 100);
      return () => {
        clearInterval(interval);
        setCustomShiftFlash(false);
      };
    }
  }, [shouldShowCustomShift, indicatorType]);


  // Match the RPM readout box exactly (text-2xl / 1.5em tall / px-4) so the
  // oil & water boxes are the same visual size.
  const tempBoxClass =
    'bg-slate-800/(--bg-opacity) text-2xl flex min-w-[5em] font-mono font-bold px-4 rounded-lg whitespace-nowrap justify-center items-center gap-1';
  const tempBoxStyle = {
    height: '1.5em',
    ['--bg-opacity' as string]: `${opacity ?? 80}%`,
  };


  const renderTempBox = (
    key: string,
    label: string,
    value: number,
    warning: boolean,
  ) => {
    const offsetPct = toOffsetPct(offset);
    return (
      <div
        key={key}
        className={`absolute`}
        style={onLeft}
      >
        {renderTemp(label, value, warning)}
      </div>
    );
  };
  return (
    <div
      className={`@container-[size] flex  justify-center items-center w-full h-full gap-2`}
    >
      {/* LED lights */}
      <div
        id="ledcontainer"
        className={`bg-slate-800/(--bg-opacity) flex relative items-center justify-center rounded-lg`}
        style={{
          ['--bg-opacity' as string]: `${opacity ?? 80}%`,
          padding: `1px`,
        }}
      >

        {/* ShiftPoint/RPM display - shows when showRpmText is true OR when custom shift points exist */}
        
          <div
            id="rpm-text"
            className={`bg-slate-800/(--bg-opacity) text-2xl flex relative font-mono font-bold text-white px-4 mx-2 rounded-lg transition-colors duration-200 whitespace-nowrap justify-center items-center rounded-full`}
            style={{
              ...getRpmBoxStyle(),
              height: '3em',
              ['--bg-opacity' as string]: `${opacity ?? 80}%`,
			  padding: `1px`,
            }}
          >
            {showRpmText && (
              <>
                {shouldShowCustomShift ? (
                  <span className="font-bold text-[2em]">SHIFT</span>
                ) : (
                  <>
                    {Math.round(clampedRpm).toLocaleString('en-US')}
                    <span className="text-[0.6em] ml-2">RPM</span>
                  </>
                )}
              </>
            )}
            {!showRpmText && shouldShowCustomShift && (
              <span className="font-bold text-[2em]">SHIFT</span>
            )}
          </div>
        
      </div>


    </div>
  );
};
