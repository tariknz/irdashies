import { useEffect, useMemo, useRef, useState } from 'react';
import { TrackDriver, TrackDrawing } from './TrackCanvas';
import { getColor, getTailwindStyle } from '@irdashies/utils/colors';
import { useDriverOffTrack } from './hooks/useDriverOffTrack';

export interface FlatTrackMapProps {
  trackDrawing: TrackDrawing;
  drivers: TrackDriver[];
  highlightColor?: number;
  showCarNumbers?: boolean;
  driverCircleSize?: number;
  playerCircleSize?: number;
}

const PADDING_X = 40;

export const FlatTrackMap = ({
  drivers,
  highlightColor,
  showCarNumbers = true,
  driverCircleSize = 20,
  playerCircleSize = 25,
}: FlatTrackMapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const driversOffTrack = useDriverOffTrack();

  const isMultiClass = useMemo(() => {
    if (!drivers || drivers.length === 0) return false;
    const uniqueClassIds = new Set(drivers.map(({ driver }) => driver.CarClassID));
    return uniqueClassIds.size > 1;
  }, [drivers]);

  const driverColors = useMemo(() => {
    const colors: Record<number, { fill: string; text: string }> = {};
    drivers?.forEach(({ driver, isPlayer }) => {
      if (isPlayer) {
        if (highlightColor) {
          const highlightColorHex = `#${highlightColor.toString(16).padStart(6, '0')}`;
          colors[driver.CarIdx] = { fill: highlightColorHex, text: 'white' };
        } else {
          colors[driver.CarIdx] = { fill: getColor('amber'), text: 'white' };
        }
      } else {
        const style = getTailwindStyle(driver.CarClassColor, undefined, isMultiClass);
        colors[driver.CarIdx] = { fill: style.canvasFill, text: 'white' };
      }
    });
    return colors;
  }, [drivers, isMultiClass, highlightColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', resize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvasSize.width === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvasSize.height / 2;
    const usableWidth = canvasSize.width - PADDING_X * 2;

    // Draw horizontal track line
    ctx.strokeStyle = getColor('slate', 600);
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PADDING_X, centerY);
    ctx.lineTo(canvasSize.width - PADDING_X, centerY);
    ctx.stroke();

    // Draw start/finish line
    ctx.strokeStyle = getColor('red');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PADDING_X, centerY - 30);
    ctx.lineTo(PADDING_X, centerY + 30);
    ctx.stroke();

    // Draw drivers
    [...drivers].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer)).forEach(({ driver, progress, isPlayer }) => {
      const color = driverColors[driver.CarIdx];
      if (!color) return;

      const x = PADDING_X + progress * usableWidth;
      const radius = isPlayer ? playerCircleSize : driverCircleSize;

      ctx.fillStyle = color.fill;
      ctx.beginPath();
      ctx.arc(x, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();

      if (driversOffTrack[driver.CarIdx]) {
        ctx.strokeStyle = getColor('yellow', 400);
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (showCarNumbers) {
        ctx.fillStyle = color.text;
        ctx.font = `${radius * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.CarNumber, x, centerY);
      }
    });
  }, [canvasSize, drivers, driverColors, driversOffTrack, showCarNumbers, driverCircleSize, playerCircleSize]);

  return <div className="w-full h-full"><canvas ref={canvasRef} className="w-full h-full" /></div>;
};
