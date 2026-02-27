import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TrackDriver, TrackDrawing } from './TrackCanvas';
import { getColor, getTailwindStyle } from '@irdashies/utils/colors';
import { useDriverOffTrack } from './hooks/useDriverOffTrack';

export interface FlatTrackMapCanvasProps {
  trackDrawing: TrackDrawing;
  drivers: TrackDriver[];
  highlightColor?: number;
  showCarNumbers?: boolean;
  displayMode?: 'carNumber' | 'sessionPosition' | 'livePosition';
  driverCircleSize?: number;
  playerCircleSize?: number;
  trackmapFontSize?: number;
  trackLineWidth?: number;
  trackOutlineWidth?: number;
  invertTrackColors?: boolean;
  driverLivePositions?: Record<number, number>;
}

const HORIZONTAL_PADDING = 40; // Fixed padding on each side

export const FlatTrackMapCanvas = ({
  drivers,
  highlightColor,
  showCarNumbers = true,
  displayMode = 'carNumber',
  driverCircleSize = 40,
  playerCircleSize = 40,
  trackmapFontSize = 100,
  trackLineWidth = 20,
  trackOutlineWidth = 40,
  invertTrackColors = false,
  driverLivePositions = [0, 0],
}: FlatTrackMapCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const driversOffTrack = useDriverOffTrack();
  const debounceResizeRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const isMultiClass = useMemo(() => {
    if (!drivers || drivers.length === 0) return false;
    const uniqueClassIds = new Set(
      drivers.map(({ driver }) => driver.CarClassID)
    );
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    // Initial resize
    resize();

    const handleResize = () => {
      if (debounceResizeRef.current) {
        clearTimeout(debounceResizeRef.current);
      }
      debounceResizeRef.current = setTimeout(() => {
        resize();
      }, 50);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    // Also observe the parent container
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (debounceResizeRef.current) {
        clearTimeout(debounceResizeRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvasSize.width === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvasSize.height / 2;
    const usableWidth = canvasSize.width - HORIZONTAL_PADDING * 2;
    const trackStartX = HORIZONTAL_PADDING;
    const trackEndX = canvasSize.width - HORIZONTAL_PADDING;

    const outlineColor = invertTrackColors ? 'white' : 'black';
    const trackColor = invertTrackColors ? 'black' : 'white';

    // Draw horizontal track line with outline (matching curved track map)
    const circleScale = 0.25; // Scale factor to match curved map coordinate space
    const scaledTrackLineWidth = trackLineWidth * circleScale;
    const scaledOutlineWidth = trackOutlineWidth * circleScale;

    // First draw outline
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = scaledOutlineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trackStartX, centerY);
    ctx.lineTo(trackEndX, centerY);
    ctx.stroke();

    // Then draw track on top
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = scaledTrackLineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trackStartX, centerY);
    ctx.lineTo(trackEndX, centerY);
    ctx.stroke();

    // Draw start/finish line
    ctx.strokeStyle = getColor('red');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(HORIZONTAL_PADDING, centerY - 10);
    ctx.lineTo(HORIZONTAL_PADDING, centerY + 10);
    ctx.stroke();

    // Draw checkered flag above the line
    const flagSize = 8;
    const flagY = centerY - 25;
    const flagX = HORIZONTAL_PADDING - flagSize;

    // Draw 2x2 checkered pattern
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const isBlack = (row + col) % 2 === 0;
        ctx.fillStyle = isBlack ? 'black' : 'white';
        ctx.fillRect(
          flagX + col * flagSize,
          flagY + row * flagSize,
          flagSize,
          flagSize
        );
      }
    }

    // Add border around flag
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(flagX, flagY, flagSize * 2, flagSize * 2);

    // Draw drivers
    // Apply scale factor to match curved track map proportions
    [...drivers]
      .sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))
      .forEach(({ driver, progress, isPlayer, classPosition }) => {
        const color = driverColors[driver.CarIdx];
        if (!color) return;

        const x = HORIZONTAL_PADDING + progress * usableWidth;
        const radius =
          (isPlayer ? playerCircleSize : driverCircleSize) * circleScale;
        const fontSize = radius * (trackmapFontSize / 100);

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
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let displayText = '';
          if (displayMode === 'livePosition') {
            const livePosition = driverLivePositions[driver.CarIdx] ?? classPosition;
            displayText =
              livePosition !== undefined && livePosition > 0
                ? livePosition.toString()
                : '';
          } else if (displayMode === 'sessionPosition') {
            displayText =
              classPosition !== undefined && classPosition > 0
                ? classPosition.toString()
                : '';
          } else {
            displayText = driver.CarNumber;
          }
          if (displayText) {
            const m = ctx.measureText(displayText);
            const visualOffset =
              (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
            ctx.fillText(displayText, x, centerY + visualOffset);
          }
        }
      });
  }, [
    canvasSize,
    drivers,
    driverColors,
    driversOffTrack,
    showCarNumbers,
    displayMode,
    driverCircleSize,
    playerCircleSize,
    trackmapFontSize,
    trackLineWidth,
    trackOutlineWidth,
    invertTrackColors,
    driverLivePositions,
  ]);

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};
