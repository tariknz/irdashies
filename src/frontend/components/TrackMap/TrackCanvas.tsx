import { useEffect, useMemo, useRef, useState } from 'react';
import { Driver } from '@irdashies/types';
import tracks from './tracks/tracks.json';
import { getColor, getTailwindStyle } from '@irdashies/utils/colors';
import { shouldShowTrack } from './tracks/brokenTracks';
import { TrackDebug } from './TrackDebug';
import { useStartFinishLine } from './hooks/useStartFinishLine';
import {
  setupCanvasContext,
  drawTrack,
  drawStartFinishLine,
  drawTurnNames,
  drawDrivers,
} from './trackDrawingUtils';

export interface TrackProps {
  trackId: number;
  drivers: TrackDriver[];
  enableTurnNames?: boolean;
  debug?: boolean;
}

export interface TrackDriver {
  driver: Driver;
  progress: number;
  isPlayer: boolean;
}

export interface TrackDrawing {
  active: {
    inside: string;
    outside: string;
    trackPathPoints?: { x: number; y: number }[];
    totalLength?: number;
  };
  startFinish: {
    line?: string;
    arrow?: string;
    point?: { x?: number; y?: number; length?: number } | null;
    direction?: 'clockwise' | 'anticlockwise' | null;
  };
  turns?: {
    x?: number;
    y?: number;
    content?: string;
  }[];
}

const TRACK_DRAWING_WIDTH = 1920;
const TRACK_DRAWING_HEIGHT = 1080;

export const TrackCanvas = ({
  trackId,
  drivers,
  enableTurnNames,
  debug,
}: TrackProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const trackDrawing = (tracks as unknown as TrackDrawing[])[trackId];
  const shouldShow = shouldShowTrack(trackId, trackDrawing);

  // Memoize Path2D objects to avoid re-creating them on every render
  // this is used to draw the track and start/finish line
  const path2DObjects = useMemo(() => {
    if (!trackDrawing?.active?.inside || !trackDrawing?.startFinish?.line)
      return null;

    return {
      inside: trackDrawing.active.inside
        ? new Path2D(trackDrawing.active.inside)
        : null,
      startFinish: trackDrawing.startFinish.line
        ? new Path2D(trackDrawing.startFinish.line)
        : null,
    };
  }, [trackDrawing?.active?.inside, trackDrawing?.startFinish?.line]);

  // Memoize color calculations
  const driverColors = useMemo(() => {
    const colors: Record<number, { fill: string; text: string }> = {};

    drivers?.forEach(({ driver, isPlayer }) => {
      if (isPlayer) {
        colors[driver.CarIdx] = { fill: getColor('yellow'), text: 'white' };
      } else {
        const style = getTailwindStyle(driver.CarClassColor);
        colors[driver.CarIdx] = { fill: style.canvasFill, text: 'white' };
      }
    });

    return colors;
  }, [drivers]);

  // Get start/finish line calculations
  const startFinishLine = useStartFinishLine({
    startFinishPoint: trackDrawing?.startFinish?.point,
    trackPathPoints: trackDrawing?.active?.trackPathPoints,
  });

  // Position calculation based on the percentage of the track completed
  const calculatePositions = useMemo(() => {
    if (
      !trackDrawing?.active?.trackPathPoints ||
      !trackDrawing?.startFinish?.point?.length ||
      !trackDrawing?.active?.totalLength
    ) {
      return {};
    }

    const trackPathPoints = trackDrawing.active.trackPathPoints;
    const direction = trackDrawing.startFinish.direction;
    const intersectionLength = trackDrawing.startFinish.point.length;
    const totalLength = trackDrawing.active.totalLength;

    return drivers.reduce(
      (acc, { driver, progress, isPlayer }) => {
        // Calculate position based on progress
        const adjustedLength = (totalLength * progress) % totalLength;
        const length =
          direction === 'anticlockwise'
            ? (intersectionLength + adjustedLength) % totalLength
            : (intersectionLength - adjustedLength + totalLength) % totalLength;

        // Find the closest trackPath point
        const pointIndex = Math.round(
          (length / totalLength) * (trackPathPoints.length - 1)
        );
        const clampedIndex = Math.max(
          0,
          Math.min(pointIndex, trackPathPoints.length - 1)
        );
        const position = trackPathPoints[clampedIndex];

        return {
          ...acc,
          [driver.CarIdx]: { position, driver, isPlayer, progress },
        };
      },
      {} as Record<number, TrackDriver & { position: { x: number; y: number } }>
    );
  }, [
    drivers,
    trackDrawing?.active?.trackPathPoints,
    trackDrawing?.startFinish?.point?.length,
    trackDrawing?.startFinish?.direction,
    trackDrawing?.active?.totalLength,
  ]);

  // Canvas setup effect
  // this is used to set the canvas size to the correct size
  // and handles resizing the canvas when the container is resized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      if (!canvas) return;

      // Get device pixel ratio for high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Set the actual canvas size in memory (scaled up for high-DPI)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Set the CSS size to maintain the same visual size
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      // Apply device pixel ratio scaling to the context
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        ctx.scale(dpr, dpr); // Apply DPR scaling
      }
      // Update state to trigger redraw
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    // Initial resize
    resize();

    // Use ResizeObserver to watch the canvas container
    const resizeObserver = new ResizeObserver(() => {
      resize();
    });

    // Observe the canvas element itself
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [trackId]);

  // Render track and drivers (main render loop)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !path2DObjects) return;

    const rect = canvas.getBoundingClientRect();

    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale to fit the 1920x1080 track into the current canvas size
    const scaleX = rect.width / TRACK_DRAWING_WIDTH;
    const scaleY = rect.height / TRACK_DRAWING_HEIGHT;
    const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

    // Calculate centering offset
    const offsetX = (rect.width - TRACK_DRAWING_WIDTH * scale) / 2;
    const offsetY = (rect.height - TRACK_DRAWING_HEIGHT * scale) / 2;

    // Setup canvas context with scaling and shadow
    setupCanvasContext(ctx, scale, offsetX, offsetY);

    // Draw all elements
    drawTrack(ctx, path2DObjects);
    drawStartFinishLine(ctx, startFinishLine);
    drawTurnNames(ctx, trackDrawing.turns, enableTurnNames);
    drawDrivers(ctx, calculatePositions, driverColors);

    // Restore context state
    ctx.restore();
  }, [
    calculatePositions,
    path2DObjects,
    trackDrawing?.turns,
    driverColors,
    canvasSize,
    enableTurnNames,
    trackDrawing?.startFinish?.point,
    trackDrawing?.active?.trackPathPoints,
    startFinishLine,
  ]);

  // Development/Storybook mode - show debug info and canvas
  if (debug) {
    return (
      <div className="overflow-hidden w-full h-full">
        <TrackDebug trackId={trackId} trackDrawing={trackDrawing} />
        <canvas
          className="will-change-transform w-full h-full"
          ref={canvasRef}
        ></canvas>
      </div>
    );
  }

  // Hide broken tracks in production
  if (!shouldShow) return null;

  return (
    <div className="overflow-hidden w-full h-full">
      <canvas
        className="will-change-transform w-full h-full"
        ref={canvasRef}
      ></canvas>
    </div>
  );
};
