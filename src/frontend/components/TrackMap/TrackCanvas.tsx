import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useDriverOffTrack } from './hooks/useDriverOffTrack';
import { useDriverLivePositions } from '../Standings/hooks/useDriverLivePositions';

export interface TrackProps {
  trackId: number;
  drivers: TrackDriver[];
  enableTurnNames?: boolean;
  showCarNumbers?: boolean;
  displayMode?: 'carNumber' | 'sessionPosition' | 'livePosition';
  invertTrackColors?: boolean;
  highContrastTurns?: boolean;
  driverCircleSize?: number;
  playerCircleSize?: number;
  trackmapFontSize?: number;
  trackLineWidth?: number;
  trackOutlineWidth?: number;
  highlightColor?: number;
  isMinimal?: boolean;
  debug?: boolean;
}

export interface TrackDriver {
  driver: Driver;
  progress: number;
  isPlayer: boolean;
  classPosition?: number;
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
  showCarNumbers = true,
  displayMode = 'carNumber',
  invertTrackColors = false,
  highContrastTurns = false,
  driverCircleSize = 40,
  playerCircleSize = 40,
  trackmapFontSize = 100,
  trackLineWidth = 20,
  trackOutlineWidth = 40,
  highlightColor,
  isMinimal = false,
  debug,
}: TrackProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheParamsRef = useRef<string>('');
  const debounceResizeRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const trackDrawing = (tracks as unknown as TrackDrawing[])[trackId];
  const shouldShow = shouldShowTrack(trackId, trackDrawing);

  const driversOffTrack = useDriverOffTrack();
  const driverLivePositions = useDriverLivePositions({
    enabled: displayMode === 'livePosition',
  });

  // Memoize Path2D objects to avoid re-creating them on every render
  // this is used to draw the track and start/finish line
  const insidePath = trackDrawing?.active?.inside;
  const startFinishLinePath = trackDrawing?.startFinish?.line;
  const path2DObjects = useMemo(() => {
    if (!insidePath || !startFinishLinePath) return null;

    return {
      inside: new Path2D(insidePath),
      startFinish: new Path2D(startFinishLinePath),
    };
  }, [insidePath, startFinishLinePath]);

  // Calculate if this is a multi-class race by counting unique CarClassID values
  const isMultiClass = useMemo(() => {
    if (!drivers || drivers.length === 0) return false;
    const uniqueClassIds = new Set(
      drivers.map(({ driver }) => driver.CarClassID)
    );
    return uniqueClassIds.size > 1;
  }, [drivers]);

  // Memoize color calculations
  const driverColors = useMemo(() => {
    const colors: Record<number, { fill: string; text: string }> = {};

    drivers?.forEach(({ driver, isPlayer }) => {
      if (isPlayer) {
        if (highlightColor) {
          // Convert highlight color number to hex string for canvas
          const highlightColorHex = `#${highlightColor.toString(16).padStart(6, '0')}`;
          colors[driver.CarIdx] = { fill: highlightColorHex, text: 'white' };
        } else {
          // Default to amber when highlightColor is undefined
          colors[driver.CarIdx] = { fill: getColor('amber'), text: 'white' };
        }
      } else {
        const style = getTailwindStyle(
          driver.CarClassColor,
          undefined,
          isMultiClass
        );
        colors[driver.CarIdx] = { fill: style.canvasFill, text: 'white' };
      }
    });

    return colors;
  }, [drivers, isMultiClass, highlightColor]);

  // Get start/finish line calculations
  const startFinishLine = useStartFinishLine({
    startFinishPoint: trackDrawing?.startFinish?.point,
    trackPathPoints: trackDrawing?.active?.trackPathPoints,
  });

  // Position calculation based on the percentage of the track completed
  // with linear interpolation between track points for sub-pixel smoothness
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

    return drivers.reduce<
      Record<
        number,
        TrackDriver & {
          position: { x: number; y: number };
          sessionPosition?: number;
        }
      >
    >(
      (acc, { driver, progress, isPlayer, classPosition: sessionPosition }) => {
        // Calculate position based on progress
        const adjustedLength = (totalLength * progress) % totalLength;
        const length =
          direction === 'anticlockwise'
            ? (intersectionLength + adjustedLength) % totalLength
            : (intersectionLength - adjustedLength + totalLength) % totalLength;

        // --- Linear Interpolation between points ---
        const floatIndex =
          (length / totalLength) * (trackPathPoints.length - 1);
        const index1 = Math.floor(floatIndex);
        const index2 = Math.min(index1 + 1, trackPathPoints.length - 1);
        const t = floatIndex - index1;

        const p1 = trackPathPoints[index1];
        const p2 = trackPathPoints[index2];

        const canvasPosition = {
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        };

        return {
          ...acc,
          [driver.CarIdx]: {
            position: canvasPosition,
            driver,
            isPlayer,
            progress,
            sessionPosition,
          },
        } as Record<
          number,
          TrackDriver & {
            position: { x: number; y: number };
            sessionPosition?: number;
          }
        >;
      },
      {} as Record<
        number,
        TrackDriver & {
          position: { x: number; y: number };
          sessionPosition?: number;
        }
      >
    );
  }, [
    drivers,
    trackDrawing?.active?.trackPathPoints,
    trackDrawing?.startFinish?.point?.length,
    trackDrawing?.startFinish?.direction,
    trackDrawing?.active?.totalLength,
  ]);

  // Canvas setup and resize handling
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
      // Clear existing timeout
      if (debounceResizeRef.current) {
        clearTimeout(debounceResizeRef.current);
      }

      // Set new timeout
      debounceResizeRef.current = setTimeout(() => {
        resize();
      }, 50);
    });

    // Observe the canvas element itself
    resizeObserver.observe(canvas);

    // Add window resize listener as fallback
    const handleWindowResize = () => {
      if (debounceResizeRef.current) {
        clearTimeout(debounceResizeRef.current);
      }
      debounceResizeRef.current = setTimeout(() => {
        resize();
      }, 50);
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (debounceResizeRef.current) {
        clearTimeout(debounceResizeRef.current);
      }
      cacheCanvasRef.current = null;
      cacheParamsRef.current = '';
    };
  }, [trackId]);

  // Main render loop
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !path2DObjects) return;

    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    // 1. Prepare/Update Static Cache
    if (!cacheCanvasRef.current) {
      cacheCanvasRef.current = document.createElement('canvas');
    }
    const cacheCanvas = cacheCanvasRef.current;

    // Create a unique key for current static settings to identify when cache is invalid
    const currentParams = JSON.stringify({
      trackId,
      width: canvasSize.width,
      height: canvasSize.height,
      enableTurnNames,
      invertTrackColors,
      highContrastTurns,
      trackLineWidth,
      trackOutlineWidth,
      trackmapFontSize,
      sfPointX: startFinishLine?.point?.x,
      sfPointY: startFinishLine?.point?.y,
    });

    if (cacheParamsRef.current !== currentParams) {
      const cacheCtx = cacheCanvas.getContext('2d');
      if (cacheCtx) {
        cacheCanvas.width = canvas.width;
        cacheCanvas.height = canvas.height;

        const scaleX = canvasSize.width / TRACK_DRAWING_WIDTH;
        const scaleY = canvasSize.height / TRACK_DRAWING_HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvasSize.width - TRACK_DRAWING_WIDTH * scale) / 2;
        const offsetY = (canvasSize.height - TRACK_DRAWING_HEIGHT * scale) / 2;

        const dpr = window.devicePixelRatio || 1;
        cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
        cacheCtx.scale(dpr, dpr);

        setupCanvasContext(cacheCtx, scale, offsetX, offsetY, isMinimal);
        drawTrack(
          cacheCtx,
          path2DObjects,
          invertTrackColors,
          trackLineWidth,
          trackOutlineWidth
        );
        drawStartFinishLine(cacheCtx, startFinishLine);
        drawTurnNames(
          cacheCtx,
          trackDrawing.turns,
          enableTurnNames,
          highContrastTurns,
          trackmapFontSize
        );
        cacheCtx.restore();

        cacheParamsRef.current = currentParams;
      }
    }

    // 2. Blit cache to main canvas (identity transform to avoid double DPR scaling)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cacheCanvas, 0, 0);
    ctx.restore();

    // 3. Draw dynamic elements (drivers)
    const scaleX = canvasSize.width / TRACK_DRAWING_WIDTH;
    const scaleY = canvasSize.height / TRACK_DRAWING_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.width - TRACK_DRAWING_WIDTH * scale) / 2;
    const offsetY = (canvasSize.height - TRACK_DRAWING_HEIGHT * scale) / 2;

    setupCanvasContext(ctx, scale, offsetX, offsetY, isMinimal);
    drawDrivers(
      ctx,
      calculatePositions,
      driverColors,
      driversOffTrack,
      driverCircleSize,
      playerCircleSize,
      trackmapFontSize,
      showCarNumbers,
      displayMode,
      driverLivePositions
    );
    ctx.restore();
  }, [
    calculatePositions,
    path2DObjects,
    trackDrawing?.turns,
    driverColors,
    canvasSize,
    enableTurnNames,
    showCarNumbers,
    displayMode,
    invertTrackColors,
    highContrastTurns,
    trackLineWidth,
    trackOutlineWidth,
    startFinishLine,
    driversOffTrack,
    driverLivePositions,
    driverCircleSize,
    playerCircleSize,
    trackmapFontSize,
    trackId,
    isMinimal,
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
