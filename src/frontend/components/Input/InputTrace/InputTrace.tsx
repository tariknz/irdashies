import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useWidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';
import { perfMetrics } from '@irdashies/utils/perfMetrics';
import {
  InputTraceDrawing,
  type InputTraceInput,
  type InputTraceSettings,
} from './inputTraceDrawing';

export interface InputTraceProps {
  input: InputTraceInput;
  settings?: Partial<InputTraceSettings>;
}

/** Canvas trace sampled on input updates and painted on animation frames. */
export const InputTrace = memo(({ input, settings }: InputTraceProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<InputTraceDrawing | null>(null);
  const widgetScale = useWidgetScale();

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawingRef.current = new InputTraceDrawing(ctx);
    return () => {
      drawingRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const resize = () => {
      const ratio = (window.devicePixelRatio || 1) * widgetScale;
      const nextWidth = Math.max(0, Math.round(width * ratio));
      const nextHeight = Math.max(0, Math.round(height * ratio));
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      const drawing = drawingRef.current;
      if (drawing) perfMetrics.measure('inputTraceFrame', drawing.paint);
    };
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      resize();
    });
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [widgetScale]);

  useEffect(() => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    drawing.configure(settings);
    drawing.sample(input);
    const handle = requestAnimationFrame(() =>
      perfMetrics.measure('inputTraceFrame', drawing.paint)
    );
    return () => cancelAnimationFrame(handle);
  }, [input, settings]);

  return (
    <canvas ref={canvasRef} className="block w-full h-full min-w-0 min-h-0" />
  );
});
InputTrace.displayName = 'InputTrace';
