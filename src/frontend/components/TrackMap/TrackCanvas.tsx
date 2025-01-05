import { useEffect, useMemo, useRef, useState } from 'react';
import { Driver } from '@irdashies/types';
import tracks from './tracks/tracks.json';
import colors from 'tailwindcss/colors';
import { getTailwindColor } from '../../utils/colors';

export type TrackProps = {
  trackId: number;
  drivers: TrackDriver[];
};

export type TrackDriver = {
  driver: Driver;
  progress: number;
  isPlayer: boolean;
};

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
  const line = useMemo(() => {
    const svgPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    svgPath.setAttribute('d', trackDrawing?.active?.inside || '');
    return svgPath;
  }, [trackDrawing?.active?.inside]);

  useEffect(() => {
    if (trackDrawing?.startFinish?.point?.length === undefined) return;
    if (!drivers?.length) return;

    const direction = trackDrawing.startFinish?.direction;
    const intersectionLength = trackDrawing.startFinish?.point?.length || 0;
    const totalLength = line.getTotalLength() || 0;

    function updateCarPosition(percent: number) {
      const adjustedLength = (totalLength * percent) % totalLength;
      const length =
        direction === 'anticlockwise'
          ? (intersectionLength + adjustedLength) % totalLength
          : (intersectionLength - adjustedLength + totalLength) % totalLength;
      const point = line?.getPointAtLength(length);

      return { x: point?.x || 0, y: point?.y || 0 };
    }

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
  }, [
    drivers,
    line,
    trackDrawing?.active.inside,
    trackDrawing?.startFinish?.direction,
    trackDrawing?.startFinish?.point?.length,
  ]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = window.innerWidth / 1920;
      canvas.width = window.innerWidth;
      canvas.height = 1080 * scale;
      ctx.scale(scale, scale);
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
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, 1920, 1080);

      // Shadow
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const inside = new Path2D(trackDrawing.active.inside);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 20;
      ctx.stroke(inside);

      const startFinish = new Path2D(trackDrawing.startFinish.line);
      ctx.lineWidth = 10;
      ctx.strokeStyle = colors.red['500'];
      ctx.stroke(startFinish);

      trackDrawing.turns?.forEach((turn) => {
        if (!turn.content || !turn.x || !turn.y) return;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.font = '2rem sans-serif';
        ctx.fillText(turn.content, turn.x, turn.y);
      });

      Object.values(positions)
        .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))
        .forEach(({ driver, position, isPlayer }) => {
          ctx.fillStyle = isPlayer
            ? colors.yellow['500']
            : getTailwindColor(driver.CarClassColor).canvasFill;
          ctx.beginPath();
          ctx.arc(position.x, position.y, 40, 0, 2 * Math.PI);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'white';
          ctx.font = '2rem sans-serif';
          ctx.fillText(driver.CarNumber, position.x, position.y);
        });
    };

    // Animation loop
    const animate = () => {
      draw();
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Cleanup on component unmount
    return () => {
      if (!animationFrameIdRef.current) return;
      cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [
    positions,
    trackDrawing?.active?.inside,
    trackDrawing?.startFinish?.line,
    trackDrawing?.turns,
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
          className="will-change-transform"
          width={1920}
          height={1080}
          ref={canvasRef}
        ></canvas>
      </div>
    </>
  );
};
