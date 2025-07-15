import { useMemo } from 'react';

interface StartFinishPoint {
  x: number;
  y: number;
}

interface TrackPathPoint {
  x: number;
  y: number;
}

interface StartFinishLine {
  point: StartFinishPoint;
  perpendicular: { x: number; y: number };
}

interface UseStartFinishLineProps {
  startFinishPoint?: { x?: number; y?: number; length?: number } | null;
  trackPathPoints?: TrackPathPoint[];
}

export const useStartFinishLine = ({
  startFinishPoint,
  trackPathPoints,
}: UseStartFinishLineProps): StartFinishLine | null => {
  return useMemo(() => {
    if (
      startFinishPoint?.x === undefined ||
      startFinishPoint?.y === undefined ||
      !trackPathPoints
    ) {
      return null;
    }

    let closestIndex = 0;
    let minDistance = Infinity;

    // Find the closest point on the track path to the start/finish point
    for (let i = 0; i < trackPathPoints.length; i++) {
      const point = trackPathPoints[i];
      const distance = Math.sqrt(
        Math.pow(point.x - startFinishPoint.x, 2) + 
        Math.pow(point.y - startFinishPoint.y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    // Calculate the tangent direction at the closest point
    const tangent = { x: 0, y: 0 };
    if (closestIndex > 0 && closestIndex < trackPathPoints.length - 1) {
      // Use points on either side to calculate tangent
      const prev = trackPathPoints[closestIndex - 1];
      const next = trackPathPoints[closestIndex + 1];
      tangent.x = next.x - prev.x;
      tangent.y = next.y - prev.y;
    } else if (closestIndex === 0) {
      // At the start, use the next point
      const next = trackPathPoints[1];
      tangent.x = next.x - trackPathPoints[0].x;
      tangent.y = next.y - trackPathPoints[0].y;
    } else {
      // At the end, use the previous point
      const prev = trackPathPoints[trackPathPoints.length - 2];
      tangent.x = trackPathPoints[trackPathPoints.length - 1].x - prev.x;
      tangent.y = trackPathPoints[trackPathPoints.length - 1].y - prev.y;
    }

    // Normalize the tangent vector
    const tangentLength = Math.sqrt(
      tangent.x * tangent.x + tangent.y * tangent.y
    );
    tangent.x /= tangentLength;
    tangent.y /= tangentLength;

    // Calculate the perpendicular vector (rotate 90 degrees)
    const perpendicular = { x: -tangent.y, y: tangent.x };

    return {
      point: { x: startFinishPoint.x, y: startFinishPoint.y },
      perpendicular,
    };
  }, [startFinishPoint, trackPathPoints]);
}; 