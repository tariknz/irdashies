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
  drawSectorGaps,
  drawSectorStatuses,
  type SectorStatusColor,
} from './trackDrawingUtils';
import { useDriverOffTrack } from './hooks/useDriverOffTrack';
import { useDriverLivePositions } from '../Standings/hooks/useDriverLivePositions';
import { useTelemetryValues } from '@irdashies/context';

export interface DriverIdentity {
  driver: Driver;
  isPlayer: boolean;
  classPosition?: number;
}

export interface TrackProps {
  trackId: number;
  drivers: TrackDriver[];
  driverIdentities?: DriverIdentity[];
  turnLabels?: {
    enabled: boolean;
    labelType: 'names' | 'numbers' | 'both';
    highContrast: boolean;
    labelFontSize: number;
  };
  showCarNumbers?: boolean;
  displayMode?: 'carNumber' | 'sessionPosition' | 'livePosition';
  invertTrackColors?: boolean;
  driverCircleSize?: number;
  playerCircleSize?: number;
  trackmapFontSize?: number;
  trackLineWidth?: number;
  trackOutlineWidth?: number;
  highlightColor?: number;
  debug?: boolean;
  isMinimalTrack?: boolean;
  isMinimalCar?: boolean;
  showSectorGaps?: boolean;
  sectorBoundaries?: number[] | null;
  sectorStatuses?: SectorStatusColor[] | null;
  activeSectorIndex?: number | null;
  playerProgress?: number;
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

export interface TurnLabels {
  enabled: boolean;
  labelType: 'names' | 'numbers' | 'both';
  highContrast: boolean;
  labelFontSize: number;
}

const TRACK_DRAWING_WIDTH = 1920;
const TRACK_DRAWING_HEIGHT = 1080;

export const TrackCanvas = ({
  trackId,
  drivers,
  driverIdentities,
  turnLabels = {
    enabled: false,
    labelType: 'both',
    highContrast: true,
    labelFontSize: 100,
  },
  showCarNumbers = true,
  displayMode = 'carNumber',
  invertTrackColors = false,
  driverCircleSize = 40,
  playerCircleSize = 40,
  trackmapFontSize = 100,
  trackLineWidth = 20,
  trackOutlineWidth = 40,
  highlightColor,
  debug,
  isMinimalTrack = false,
  isMinimalCar = false,
  showSectorGaps = false,
  sectorBoundaries = null,
  sectorStatuses = null,
  activeSectorIndex = null,
}: TrackProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const carIdxIsOnPitRoad = useTelemetryValues('CarIdxOnPitRoad');

  // Memoize Path2D objects to avoid re-creating them on every render
  const insidePath = trackDrawing?.active?.inside;
  const startFinishLinePath = trackDrawing?.startFinish?.line;
  const path2DObjects = useMemo(() => {
    if (!insidePath || !startFinishLinePath) return null;

    return {
      inside: new Path2D(insidePath),
      startFinish: new Path2D(startFinishLinePath),
    };
  }, [insidePath, startFinishLinePath]);

  // Fall back to deriving identities from drivers when not provided (e.g. stories)
  const resolvedIdentities = driverIdentities ?? drivers;

  // Calculate if this is a multi-class race — depends on stable identities
  const isMultiClass = useMemo(() => {
    if (!resolvedIdentities || resolvedIdentities.length === 0) return false;
    const uniqueClassIds = new Set(
      resolvedIdentities.map(({ driver }) => driver.CarClassID)
    );
    return uniqueClassIds.size > 1;
  }, [resolvedIdentities]);

  // Memoize color calculations — depends on stable identities, so this
  // only recomputes when the driver roster actually changes.
  const driverColors = useMemo(() => {
    const colors: Record<number, { fill: string; text: string }> = {};

    resolvedIdentities?.forEach(({ driver, isPlayer }) => {
      if (isPlayer) {
        if (highlightColor) {
          const highlightColorHex = `#${highlightColor.toString(16).padStart(6, '0')}`;
          colors[driver.CarIdx] = { fill: highlightColorHex, text: 'white' };
        } else {
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
  }, [resolvedIdentities, isMultiClass, highlightColor]);

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

    const result: Record<
      number,
      TrackDriver & {
        position: { x: number; y: number };
        sessionPosition?: number;
      }
    > = {};

    for (const {
      driver,
      progress,
      isPlayer,
      classPosition: sessionPosition,
    } of drivers) {
      // Calculate position based on progress
      const adjustedLength = (totalLength * progress) % totalLength;
      const length =
        direction === 'anticlockwise'
          ? (intersectionLength + adjustedLength) % totalLength
          : (intersectionLength - adjustedLength + totalLength) % totalLength;

      // --- Linear Interpolation between points ---
      const floatIndex = (length / totalLength) * (trackPathPoints.length - 1);
      const index1 = Math.floor(floatIndex);
      const index2 = Math.min(index1 + 1, trackPathPoints.length - 1);
      const t = floatIndex - index1;

      const p1 = trackPathPoints[index1];
      const p2 = trackPathPoints[index2];

      result[driver.CarIdx] = {
        position: {
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        },
        driver,
        isPlayer,
        progress,
        sessionPosition,
      };
    }

    return result;
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
    };
  }, [trackId]);

  // Static layer — redraws only when track settings, size, or appearance change
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !path2DObjects) return;
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    if (!cacheCanvasRef.current) {
      cacheCanvasRef.current = document.createElement('canvas');
    }
    const cacheCanvas = cacheCanvasRef.current;
    const cacheCtx = cacheCanvas.getContext('2d');
    if (!cacheCtx) return;

    cacheCanvas.width = canvas.width;
    cacheCanvas.height = canvas.height;

    const maxCircleSize = Math.max(driverCircleSize, playerCircleSize);
    const scaleX = canvasSize.width / (TRACK_DRAWING_WIDTH + 2 * maxCircleSize);
    const scaleY =
      canvasSize.height / (TRACK_DRAWING_HEIGHT + 2 * maxCircleSize);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.width - TRACK_DRAWING_WIDTH * scale) / 2;
    const offsetY = (canvasSize.height - TRACK_DRAWING_HEIGHT * scale) / 2;

    const dpr = window.devicePixelRatio || 1;
    cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
    cacheCtx.scale(dpr, dpr);

    setupCanvasContext(cacheCtx, scale, offsetX, offsetY, isMinimalTrack);
    drawTrack(
      cacheCtx,
      path2DObjects,
      invertTrackColors,
      trackLineWidth,
      trackOutlineWidth,
      isMinimalTrack
    );
    if (
      showSectorGaps &&
      sectorBoundaries &&
      trackDrawing.active.trackPathPoints
    ) {
      drawSectorGaps(
        cacheCtx,
        trackDrawing.active.trackPathPoints,
        sectorBoundaries,
        trackLineWidth,
        trackOutlineWidth,
        trackDrawing.startFinish?.point?.length,
        trackDrawing.startFinish?.direction
      );
    }
    drawTurnNames(cacheCtx, trackDrawing.turns, turnLabels);
    cacheCtx.restore();

    // Blit to main canvas so static-only changes are visible immediately
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(cacheCanvas, 0, 0);
      ctx.restore();
    }
  }, [
    path2DObjects,
    trackDrawing?.turns,
    trackDrawing?.active?.totalLength,
    trackDrawing?.active?.trackPathPoints,
    trackDrawing?.startFinish?.point?.length,
    trackDrawing?.startFinish?.direction,
    turnLabels,
    canvasSize,
    invertTrackColors,
    trackLineWidth,
    trackOutlineWidth,
    trackmapFontSize,
    startFinishLine,
    driverCircleSize,
    playerCircleSize,
    isMinimalTrack,
    showSectorGaps,
    sectorBoundaries,
  ]);

  // Dynamic layer — runs on every position tick, blits static cache then draws drivers
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !cacheCanvasRef.current) return;
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    // Blit static cache (identity transform to avoid double DPR scaling)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cacheCanvasRef.current, 0, 0);
    ctx.restore();

    const maxCircleSize = Math.max(driverCircleSize, playerCircleSize);
    const scaleX = canvasSize.width / (TRACK_DRAWING_WIDTH + 2 * maxCircleSize);
    const scaleY =
      canvasSize.height / (TRACK_DRAWING_HEIGHT + 2 * maxCircleSize);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.width - TRACK_DRAWING_WIDTH * scale) / 2;
    const offsetY = (canvasSize.height - TRACK_DRAWING_HEIGHT * scale) / 2;

    // Draw active sector highlight
    if (
      showSectorGaps &&
      sectorBoundaries &&
      sectorStatuses &&
      trackDrawing.active.trackPathPoints
    ) {
      if (activeSectorIndex !== null && activeSectorIndex >= 0) {
        setupCanvasContext(ctx, scale, offsetX, offsetY, isMinimalCar);
        drawSectorStatuses(
          ctx,
          trackDrawing.active.trackPathPoints,
          sectorBoundaries,
          sectorStatuses,
          activeSectorIndex,
          trackLineWidth,
          trackOutlineWidth,
          invertTrackColors,
          trackDrawing.startFinish?.point?.length,
          trackDrawing.startFinish?.direction
        );
        ctx.restore();
      }
    }

    setupCanvasContext(ctx, scale, offsetX, offsetY, isMinimalCar);
    drawStartFinishLine(ctx, startFinishLine, trackLineWidth);
    ctx.restore();

    // Draw drivers

    setupCanvasContext(ctx, scale, offsetX, offsetY, isMinimalCar);
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
      driverLivePositions,
      carIdxIsOnPitRoad
    );
    ctx.restore();
  }, [
    calculatePositions,
    canvasSize,
    showCarNumbers,
    displayMode,
    driversOffTrack,
    driverLivePositions,
    carIdxIsOnPitRoad,
    driverCircleSize,
    playerCircleSize,
    trackmapFontSize,
    turnLabels,
    driverColors,
    isMinimalCar,
    isMinimalTrack,
    showSectorGaps,
    sectorBoundaries,
    sectorStatuses,
    activeSectorIndex,
    trackDrawing.active.trackPathPoints,
    trackDrawing.startFinish?.point?.length,
    trackDrawing.startFinish?.direction,
    trackLineWidth,
    trackOutlineWidth,
    invertTrackColors,
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
