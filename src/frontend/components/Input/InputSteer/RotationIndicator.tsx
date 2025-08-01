import { useMemo, useRef, useEffect } from 'react';

interface RotationIndicatorProps {
  currentAngleRad: number;
  className?: string;
}

export function RotationIndicator({ 
  currentAngleRad, 
  className = '' 
}: RotationIndicatorProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Memoize calculations to avoid recalculating on every render
  const { clampedPosition, bubbleColor, opacity, textColor, angleDegrees, shouldShow } = useMemo(() => {
    // Convert radians to degrees
    const angleDegrees = (currentAngleRad * -1 * 180) / Math.PI;
    
    // Only show when beyond ±180 degrees
    const shouldShow = Math.abs(angleDegrees) > 180;
    
    if (!shouldShow) {
      return {
        clampedPosition: 0,
        bubbleColor: 'rgb(255, 255, 255)',
        opacity: 0,
        textColor: 'text-slate-300',
        angleDegrees,
        shouldShow
      };
    }
    
    // Calculate bubble position for range -360° to +360°
    // Scale the small steering wheel angles to map to the full range
    const bubblePosition = (angleDegrees / (360)) * 100;
    // Clamp to container bounds
    const clampedPosition = Math.max(-100, Math.min(100, bubblePosition));

    // Calculate color intensity based on proximity to ±360°
    const absAngleDegrees = Math.abs(angleDegrees);
    const colorIntensity = Math.min(absAngleDegrees / 360, 1); // 0 to 1
    const isRed = colorIntensity > 0.5; // Start turning red at 50% of max range
    
    // Calculate transparency based on distance from center
    const centerDistance = Math.abs(angleDegrees) / 360; // 0 to 1
    const opacity = centerDistance; // 0% opacity at center, 100% at extremes
    
    // Interpolate between white and red
    const bubbleColor = isRed 
      ? `rgb(${255}, ${255 - Math.floor(colorIntensity * 255)}, ${255 - Math.floor(colorIntensity * 255)})`
      : 'rgb(255, 255, 255)';
    
    const textColor = isRed ? 'text-red-400' : 'text-slate-300';

    return {
      clampedPosition,
      bubbleColor,
      opacity,
      textColor,
      angleDegrees,
      shouldShow
    };
  }, [currentAngleRad]);

  // Use CSS custom properties for smooth updates without React re-renders
  useEffect(() => {
    if (bubbleRef.current) {
      bubbleRef.current.style.setProperty('--bubble-position', `${50 + clampedPosition}%`);
      bubbleRef.current.style.setProperty('--bubble-color', bubbleColor);
      bubbleRef.current.style.setProperty('--bubble-opacity', opacity.toString());
    }
  }, [clampedPosition, bubbleColor, opacity]);

  // Update text content without re-rendering the entire component
  useEffect(() => {
    if (textRef.current) {
      textRef.current.textContent = shouldShow ? `${angleDegrees.toFixed(0)}°` : '';
    }
  }, [angleDegrees, shouldShow]);

  // Don't render anything if not showing
  if (!shouldShow) {
    return <div className={`relative flex items-center justify-center ${className}`} />;
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Floating bubble */}
      <div 
        ref={bubbleRef}
        className="absolute w-1.5 h-1.5 rounded-full transition-all duration-200 shadow-sm"
        style={{ 
          left: 'var(--bubble-position, 50%)',
          backgroundColor: 'var(--bubble-color, rgb(255, 255, 255))',
          opacity: 'var(--bubble-opacity, 0)',
          willChange: 'left, background-color, opacity',
        }}
      />
      
      {/* Centered text */}
      <div 
        ref={textRef}
        className={`text-xs ${textColor} min-w-[2.5rem] text-center`}
      />
    </div>
  );
} 