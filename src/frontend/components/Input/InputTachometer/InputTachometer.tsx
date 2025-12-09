import { useEffect, useState } from 'react';

interface TachometerProps {
  rpm: number;
  maxRpm: number;
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
}

export const Tachometer = ({ 
  rpm, 
  maxRpm,
  shiftRpm = 0,      // Optional shift RPM (DriverCarSLShiftRPM)
  blinkRpm = 0,      // Optional blink RPM (DriverCarSLBlinkRPM)
  numLights = 10,
  ledSize = 20,
  showRpmText = true
}: TachometerProps) => {
  const [flash, setFlash] = useState(false);
  
  // Ensure RPM is within valid range
  const clampedRpm = Math.max(0, Math.min(rpm || 0, maxRpm));
  
  // Calculate effective thresholds with fallbacks
  const effectiveShiftRpm = shiftRpm || (maxRpm * 0.9);  // Purple at 90% if no shiftRpm
  const effectiveBlinkRpm = blinkRpm || (maxRpm * 0.97); // Blink at 97% if no blinkRpm
  
  // Calculate activation thresholds for each light with distinct values
  const getActivationThreshold = (ledIndex: number) => {
    // Example for 10 LEDs:
    // - First 7 LEDs (0-6): Evenly distributed between 0-80% of shiftRpm
    // - LED 7 (eighth): 80% of shiftRpm
    // - LED 8 (ninth/yellow): 85% of shiftRpm
    // - LED 9 (tenth/red): 90% of shiftRpm
    // - Purple: 100% of shiftRpm
    
    const lastLedIndex = numLights - 1;
    const secondLastIndex = numLights - 2;
    const thirdLastIndex = numLights - 3;
    
    // Special thresholds for last three LEDs
    if (ledIndex === lastLedIndex) {
      return effectiveShiftRpm * 0.90; // Last LED (red) at 90%
    } else if (ledIndex === secondLastIndex) {
      return effectiveShiftRpm * 0.85; // Second last LED (yellow) at 85%
    } else if (ledIndex === thirdLastIndex) {
      return effectiveShiftRpm * 0.80; // Third last LED (yellow) at 80%
    }
    
    // For the rest, distribute evenly between 0% and 75%
    const normalizedIndex = ledIndex / (numLights - 3);
    return effectiveShiftRpm * 0.75 * normalizedIndex;
  };

  // Calculate how many LEDs should be active based on RPM
  const getActiveLights = () => {
    // Always show no lights when RPM is 0
    if (clampedRpm <= 0) return 0;
    
    // Always show all lights when at or above shift point
    if (clampedRpm >= effectiveShiftRpm) return numLights;
    
    // Count how many LEDs should be active based on current RPM
    let activeCount = 0;
    for (let i = 0; i < numLights; i++) {
      if (clampedRpm >= getActivationThreshold(i)) {
        activeCount = i + 1;
      }
    }
    
    return activeCount;
  };
  
  const activeLights = getActiveLights();

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
    } else {
      // Make sure flash is off when not blinking
      setFlash(false);
    }
  }, [clampedRpm, effectiveBlinkRpm]);

  // Determine the color for each LED
  const getLedColor = (index: number): string => {
    // Always gray for inactive LEDs
    if (index >= activeLights) {
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
    
    // Phase 3: Below shift point - fixed color pattern based on position
    const lastLedIndex = numLights - 1;
    const secondLastIndex = numLights - 2;
    const thirdLastIndex = numLights - 3;
    
    if (index === lastLedIndex) {
      return '#ef4444'; // Red for last LED
    } else if (index === secondLastIndex || index === thirdLastIndex) {
      return '#eab308'; // Yellow for second and third last LEDs
    } else {
      return '#22c55e'; // Green for all other LEDs
    }
  };

  return (
    <div className="flex items-center gap-1 p-2 bg-slate-800/30 rounded">
      {/* LED lights */}
      <div className="flex gap-1">
        {Array.from({ length: numLights }, (_, i) => (
          <div
            key={i}
            className="rounded-full border border-gray-600 transition-all duration-200"
            style={{
              width: ledSize,
              height: ledSize,
              backgroundColor: getLedColor(i),
              boxShadow: i < activeLights ? `0 0 4px ${getLedColor(i)}` : 'none',
            }}
            aria-label={`LED ${i + 1}`}
          />
        ))}
      </div>
      
      {/* RPM display - conditional */}
      {showRpmText && (
        <div className="ml-3 text-sm font-mono font-bold text-white bg-black/50 px-2 py-1 rounded">
          {Math.round(clampedRpm).toLocaleString()}
          <span className="text-xs text-gray-300 ml-1">RPM</span>
        </div>
      )}
    </div>
  );
};
