import { useEffect, useState } from 'react';
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

export const Tachometer = ({ 
  rpm, 
  maxRpm,
  gear = 0,
  shiftRpm = 0,      // Optional shift RPM (DriverCarSLShiftRPM)
  blinkRpm = 0,      // Optional blink RPM (DriverCarSLBlinkRPM)
  numLights = 10,
  ledSize = 20,
  showRpmText = true,
  gearRpmThresholds = null,
  ledColors = null,
  carData = null,
  carPath = undefined,
  shiftPointSettings = undefined
}: TachometerProps) => {
  const [flash, setFlash] = useState(false);
  const [customShiftFlash, setCustomShiftFlash] = useState(false);
  
  // Ensure RPM is within valid range
  const clampedRpm = Math.max(0, Math.min(rpm || 0, maxRpm));
  
  // Calculate effective thresholds with fallbacks
  const effectiveShiftRpm = gearRpmThresholds ? gearRpmThresholds[0] : (shiftRpm || (maxRpm * 0.9));  // Use redline from car data
  const effectiveBlinkRpm = gearRpmThresholds ? gearRpmThresholds[0] : (blinkRpm || (maxRpm * 0.97)); // Use redline from car data
  
  // Use car-specific LED count if available
  const effectiveNumLights = carData?.ledNumber || (ledColors ? ledColors.length - 1 : numLights);
  
  // Custom shift point logic - use CarPath from iRacing (matches lovely-car-data)
  const carConfig = carPath && shiftPointSettings?.carConfigs[carPath];
  const customShiftPoint = carConfig && typeof carConfig !== 'string' ? carConfig.gearShiftPoints[gear.toString()]?.shiftRpm : undefined;
  const shouldShowCustomShift = !!(shiftPointSettings?.enabled && customShiftPoint && clampedRpm >= customShiftPoint && gear > 0);
  const indicatorType = shiftPointSettings?.indicatorType || 'glow';
  const indicatorColor = shiftPointSettings?.indicatorColor || '#00ff00';
  
  // Calculate activation thresholds for each light with distinct values
  const getActivationThreshold = (ledIndex: number) => {
    // Use car-specific thresholds if available
    if (gearRpmThresholds && gearRpmThresholds[ledIndex + 1]) {
      return gearRpmThresholds[ledIndex + 1]; // Skip first element (redline), LEDs start at index 1
    }
    
    // Fallback to original logic
    const lastLedIndex = effectiveNumLights - 1;
    const secondLastIndex = effectiveNumLights - 2;
    const thirdLastIndex = effectiveNumLights - 3;
    
    // Special thresholds for last three LEDs
    if (ledIndex === lastLedIndex) {
      return effectiveShiftRpm * 0.90; // Last LED (red) at 90%
    } else if (ledIndex === secondLastIndex) {
      return effectiveShiftRpm * 0.85; // Second last LED (yellow) at 85%
    } else if (ledIndex === thirdLastIndex) {
      return effectiveShiftRpm * 0.80; // Third last LED (yellow) at 80%
    }
    
    // For the rest, distribute evenly between 0% and 75%
    const normalizedIndex = ledIndex / (effectiveNumLights - 3);
    return effectiveShiftRpm * 0.75 * normalizedIndex;
  };

  // Calculate how many LEDs should be active based on RPM
  const getActiveLights = () => {
    // Always show no lights when RPM is 0
    if (clampedRpm <= 0) return 0;
    
    // Always show all lights when at or above shift point
    if (clampedRpm >= effectiveShiftRpm) return effectiveNumLights;
    
    // Use car-specific thresholds if available
    if (gearRpmThresholds && gearRpmThresholds.length > 1) {
      // Count how many thresholds are met (skip first element which is redline)
      let activeCount = 0;
      for (let i = 1; i < gearRpmThresholds.length && i <= effectiveNumLights; i++) {
        if (clampedRpm >= gearRpmThresholds[i]) {
          activeCount++;
        }
      }
      return activeCount;
    }
    
    // Fallback: Count how many LEDs should be active based on current RPM
    let activeCount = 0;
    for (let i = 0; i < effectiveNumLights; i++) {
      if (clampedRpm >= getActivationThreshold(i)) {
        activeCount = i + 1;
      }
    }
    
    return activeCount;
  };
  
  // Determine if a specific LED should be active (handles center-out pattern)
  const isLedActive = (ledIndex: number): boolean => {
    if (!gearRpmThresholds || gearRpmThresholds.length <= 1) {
      // Fallback: simple left-to-right
      return ledIndex < activeLights;
    }
    
    // Car-specific: check if this LED's threshold is met
    const thresholdIndex = ledIndex + 1; // Skip redline (index 0)
    if (thresholdIndex < gearRpmThresholds.length) {
      return clampedRpm >= gearRpmThresholds[thresholdIndex];
    }
    
    return false;
  };
  
  const activeLights = getActiveLights();

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
          backgroundColor: customShiftFlash ? indicatorColor : 'rgba(0,0,0,0.8)',
          color: customShiftFlash ? '#000000' : '#ffffff',
          border: `2px solid ${indicatorColor}`,
        };
      default:
        return baseStyle;
    }
  };

  // Determine if RPM box should be shown - always show when custom shift points are configured
  const hasCustomShiftPoints = !!(shiftPointSettings?.enabled && carConfig && typeof carConfig !== 'string');
  const shouldShowRpmBox = showRpmText || hasCustomShiftPoints;

  // Flash effect when RPM exceeds blink threshold
  useEffect(() => {
    // Ensure we have a valid blinkRpm
    const shouldBlink = clampedRpm >= effectiveBlinkRpm;

    if (shouldBlink) {
      // Set up flashing with a shorter interval for better visibility
      const interval = setInterval(() => {
        setFlash(prevFlash => !prevFlash);
      }, 200); // Faster flashing - 200ms instead of 250ms

      return () => {
        clearInterval(interval);
      };
    }
  }, [clampedRpm, effectiveBlinkRpm]);

  // Custom shift point flash effect
  useEffect(() => {
    if (shouldShowCustomShift && indicatorType === 'pulse') {
      const interval = setInterval(() => {
        setCustomShiftFlash(prevFlash => !prevFlash);
      }, 500);
      return () => {
        clearInterval(interval);
        setCustomShiftFlash(false);
      };
    }
  }, [shouldShowCustomShift, indicatorType]);

  // Determine the color for each LED
  const getLedColor = (index: number): string => {
    // Always gray for inactive LEDs
    if (!isLedActive(index)) {
      return '#1f2937'; // Dark gray for inactive LEDs
    }
    
    // Phase 1: At or above blinkRpm - flash purple/white with stronger colors
    if (clampedRpm >= effectiveBlinkRpm) {
      return flash ? '#ffffff' /* Brighter white */ : '#9333ea' /* More vivid purple */;
    }
    
    // Phase 2: At or above shiftRpm - solid purple
    if (clampedRpm >= effectiveShiftRpm) {
      return '#a855f7'; // Solid purple
    }
    
    // Use car-specific colors if available (convert from ARGB to RGB)
    if (ledColors && ledColors[index + 1]) {
      const argbColor = ledColors[index + 1];
      // Convert #FFRRGGBB to #RRGGBB
      if (argbColor.length === 9 && argbColor.startsWith('#FF')) {
        return '#' + argbColor.slice(3);
      }
      return argbColor;
    }
    
    // Phase 3: Below shift point - fixed color pattern based on position
    const lastLedIndex = effectiveNumLights - 1;
    const secondLastIndex = effectiveNumLights - 2;
    const thirdLastIndex = effectiveNumLights - 3;
    
    if (index === lastLedIndex) {
      return '#ef4444'; // Red for last LED
    } else if (index === secondLastIndex || index === thirdLastIndex) {
      return '#eab308'; // Yellow for second and third last LEDs
    } else {
      return '#22c55e'; // Green for all other LEDs
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 p-2 rounded">
        {/* LED lights */}
        <div className="flex gap-1">
          {Array.from({ length: effectiveNumLights }, (_, i) => (
            <div
              key={i}
              className="rounded-full border border-gray-600 transition-all duration-300"
              style={{
                width: ledSize,
                height: ledSize,
                backgroundColor: getLedColor(i),
                boxShadow: isLedActive(i) ? `0 0 4px ${getLedColor(i)}` : 'none',
              }}
              aria-label={`LED ${i + 1}`}
            />
          ))}
        </div>
        
        {/* RPM display - shows when showRpmText is true OR when custom shift points exist */}
        {shouldShowRpmBox && (
          <div 
            className="ml-3 text-sm font-mono font-bold text-white bg-black/50 px-2 rounded transition-all duration-200 whitespace-nowrap flex items-center"
            style={{
              ...getRpmBoxStyle(),
              minWidth: showRpmText ? '120px' : '60px', // Reserve space to prevent layout shift
              height: '32px', // Fixed height to prevent vertical shift
            }}
          >
            {showRpmText && (
              <>
                {Math.round(clampedRpm).toLocaleString('en-US')}
                <span className="text-xs text-gray-300 ml-1">RPM</span>
                {shouldShowCustomShift && <span className="text-xs ml-2 font-bold">SHIFT</span>}
              </>
            )}
            {!showRpmText && shouldShowCustomShift && (
              <span className="text-xs font-bold">SHIFT</span>
            )}
          </div>
        )}
      </div>
      
      {/* CSS for pulse animation - removed as it's now handled via state */}
    </>
  );
};
