import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Driver } from '@irdashies/types';
import tracks from './tracks/tracks.json';
import { getColor, getTailwindStyle } from '@irdashies/utils/colors';

export interface TrackProps {
  trackId: number;
  drivers: TrackDriver[];
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

export const TrackCanvas = ({ trackId, drivers }: TrackProps) => {
  const [positions, setPositions] = useState<
    Record<number, TrackDriver & { position: { x: number; y: number } }>
  >({});
  const trackDrawing = (tracks as unknown as TrackDrawing[])[trackId];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastDriversRef = useRef<TrackDriver[]>([]);
  const lastPositionsRef = useRef<Record<number, TrackDriver & { position: { x: number; y: number } }>>({});

  // Memoize the SVG path element
  const line = useMemo(() => {
    if (!trackDrawing?.active?.inside) return null;
    const svgPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    svgPath.setAttribute('d', trackDrawing.active.inside);
    return svgPath;
  }, [trackDrawing?.active?.inside]);

  // Memoize Path2D objects
  const path2DObjects = useMemo(() => {
    if (!trackDrawing?.active?.inside || !trackDrawing?.startFinish?.line) return null;
    
    return {
      inside: trackDrawing.active.inside ? new Path2D(trackDrawing.active.inside) : null,
      startFinish: trackDrawing.startFinish.line ? new Path2D(trackDrawing.startFinish.line) : null,
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

  // Memoize track constants
  const trackConstants = useMemo(() => {
    if (!line || !trackDrawing?.startFinish?.point?.length) return null;
    
    const direction = trackDrawing.startFinish.direction;
    const intersectionLength = trackDrawing.startFinish.point.length;
    const totalLength = line.getTotalLength();
    
    return { direction, intersectionLength, totalLength };
  }, [line, trackDrawing?.startFinish?.direction, trackDrawing?.startFinish?.point?.length]);

  // Optimized position calculation
  const updateCarPosition = useCallback((percent: number) => {
    if (!trackConstants) return { x: 0, y: 0 };
    
    const { direction, intersectionLength, totalLength } = trackConstants;
    const adjustedLength = (totalLength * percent) % totalLength;
    const length =
      direction === 'anticlockwise'
        ? (intersectionLength + adjustedLength) % totalLength
        : (intersectionLength - adjustedLength + totalLength) % totalLength;
    const point = line?.getPointAtLength(length);

    return { x: point?.x || 0, y: point?.y || 0 };
  }, [trackConstants, line]);

  // Check if drivers have actually changed
  const driversChanged = useMemo(() => {
    if (drivers.length !== lastDriversRef.current.length) return true;
    
    return drivers.some((driver, index) => {
      const lastDriver = lastDriversRef.current[index];
      return !lastDriver || 
             driver.driver.CarIdx !== lastDriver.driver.CarIdx ||
             Math.abs(driver.progress - lastDriver.progress) > 0.001 ||
             driver.isPlayer !== lastDriver.isPlayer;
    });
  }, [drivers]);

  useEffect(() => {
    if (!trackConstants || !drivers?.length || !driversChanged) return;

    const updatedPositions = drivers.reduce(
      (acc, { driver, progress, isPlayer }) => {
        const position = updateCarPosition(progress);
        return {
          ...acc,
          [driver.CarIdx]: { position, driver, isPlayer, progress },
        };
      },
      {} as Record<number, TrackDriver & { position: { x: number; y: number } }>
    );

    setPositions(updatedPositions);
    lastDriversRef.current = drivers;
    lastPositionsRef.current = updatedPositions;
  }, [drivers, trackConstants, updateCarPosition, driversChanged]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Get device pixel ratio for high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Set the actual canvas size in memory (scaled up for high-DPI)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale the drawing context so everything draws at the correct size
      ctx.scale(dpr, dpr);
      
      // Set the CSS size to maintain the same visual size
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !path2DObjects) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      
      // Clear the entire canvas
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // Calculate scale to fit the 1920x1080 track into the current canvas size
      const scaleX = rect.width / 1920;
      const scaleY = rect.height / 1080;
      const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio
      
      // Calculate centering offset
      const offsetX = (rect.width - 1920 * scale) / 2;
      const offsetY = (rect.height - 1080 * scale) / 2;
      
      // Save context state
      ctx.save();
      
      // Apply scaling and centering
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Shadow
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Draw track
      if (path2DObjects.inside) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 20;
        ctx.stroke(path2DObjects.inside);
      }

      // Draw start/finish line
      if (path2DObjects.startFinish) {
        ctx.lineWidth = 10;
        ctx.strokeStyle = getColor('red');
        ctx.stroke(path2DObjects.startFinish);
      }

      // Draw turn numbers
      trackDrawing.turns?.forEach((turn) => {
        if (!turn.content || !turn.x || !turn.y) return;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.font = '2rem sans-serif';
        ctx.fillText(turn.content, turn.x, turn.y);
      });

      // Draw drivers
      Object.values(positions)
        .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))
        .forEach(({ driver, position }) => {
          const color = driverColors[driver.CarIdx];
          if (!color) return;
          
          ctx.fillStyle = color.fill;
          ctx.beginPath();
          ctx.arc(position.x, position.y, 40, 0, 2 * Math.PI);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = color.text;
          ctx.font = '2rem sans-serif';
          ctx.fillText(driver.CarNumber, position.x, position.y);
        });
      
      // Restore context state
      ctx.restore();
    };

    // Only animate if positions have changed
    const animate = () => {
      if (JSON.stringify(positions) !== JSON.stringify(lastPositionsRef.current)) {
        draw();
        lastPositionsRef.current = { ...positions };
      }
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Cleanup on component unmount
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [
    positions,
    path2DObjects,
    trackDrawing?.turns,
    driverColors,
  ]);

  if (!trackDrawing?.active?.inside) {
    return <>Track map unavailable</>;
  }

  return (
    <>
      {!trackDrawing?.startFinish?.point && (
        <p className="text-sm">Track start point unavailable</p>
      )}
      <div className="overflow-hidden w-full h-full">
        <canvas
          className="will-change-transform w-full h-full"
          ref={canvasRef}
        ></canvas>
      </div>
    </>
  );
};
