import { useEffect, useRef, useState } from 'react';

export interface WheelRotationState {
  totalRotations: number;
  currentAngle: number;
  rotationDirection: 'clockwise' | 'counterclockwise' | 'none';
  hasRotatedOver360: boolean;
}

export const useWheelRotation = (angleRad = 0) => {
  const [rotationState, setRotationState] = useState<WheelRotationState>({
    totalRotations: 0,
    currentAngle: 0,
    rotationDirection: 'none',
    hasRotatedOver360: false,
  });
  
  const prevAngleRef = useRef<number>(0);
  const totalRotationRef = useRef<number>(0);
  const lastDirectionRef = useRef<'clockwise' | 'counterclockwise' | 'none'>('none');

  useEffect(() => {
    const currentAngle = angleRad;
    const prevAngle = prevAngleRef.current;
    
    if (prevAngle === 0 && currentAngle === 0) {
      return;
    }

    // Calculate the angle difference, handling wraparound
    let angleDiff = currentAngle - prevAngle;
    
    // Handle wraparound at ±π
    if (angleDiff > Math.PI) {
      angleDiff -= 2 * Math.PI;
    } else if (angleDiff < -Math.PI) {
      angleDiff += 2 * Math.PI;
    }

    // Determine rotation direction
    let direction: 'clockwise' | 'counterclockwise' | 'none' = 'none';
    if (Math.abs(angleDiff) > 0.01) { // Threshold to avoid noise
      direction = angleDiff > 0 ? 'clockwise' : 'counterclockwise';
    }

    // Update total rotation
    if (direction !== 'none') {
      totalRotationRef.current += angleDiff;
    }

    // Calculate total rotations (360 degrees = 2π radians)
    const totalRotations = Math.abs(totalRotationRef.current) / (2 * Math.PI);
    const hasRotatedOver360 = totalRotations >= 1;

    setRotationState({
      totalRotations: Math.floor(totalRotations),
      currentAngle,
      rotationDirection: direction,
      hasRotatedOver360,
    });

    prevAngleRef.current = currentAngle;
    lastDirectionRef.current = direction;
  }, [angleRad]);

  return rotationState;
}; 