import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  zoomPreviewAt,
  type PreviewViewport,
} from '@irdashies/domain/widgetPreview/viewport';

export function usePreviewViewport(
  stage: RefObject<HTMLDivElement | null>,
  fit: number,
  enabled: boolean
) {
  const [mode, setMode] = useState<'fit' | 'actual' | 'custom'>('fit');
  const [view, setView] = useState<PreviewViewport>({
    scale: 1,
    pan: { x: 0, y: 0 },
  });
  const scale = mode === 'fit' ? fit : mode === 'actual' ? 1 : view.scale;
  const current = useRef({ scale, pan: view.pan });
  current.current = { scale, pan: view.pan };
  const target = useRef<PreviewViewport | null>(null);
  const animation = useRef<number | undefined>(undefined);
  const stop = () => {
    if (animation.current !== undefined)
      cancelAnimationFrame(animation.current);
    animation.current = undefined;
    target.current = null;
  };
  useEffect(() => {
    const element = stage.current;
    if (!element || !enabled) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let previousTime = 0;
    const tick = (time: number) => {
      const destination = target.current;
      if (!destination) return;
      const amount =
        1 -
        Math.exp(-Math.min(64, previousTime ? time - previousTime : 16) / 45);
      previousTime = time;
      const before = current.current;
      const done =
        Math.abs(before.scale - destination.scale) < 0.0001 &&
        Math.hypot(
          before.pan.x - destination.pan.x,
          before.pan.y - destination.pan.y
        ) < 0.05;
      const next = done
        ? destination
        : {
            scale: before.scale + (destination.scale - before.scale) * amount,
            pan: {
              x: before.pan.x + (destination.pan.x - before.pan.x) * amount,
              y: before.pan.y + (destination.pan.y - before.pan.y) * amount,
            },
          };
      current.current = next;
      setView(next);
      if (done) {
        animation.current = undefined;
        target.current = null;
      } else animation.current = requestAnimationFrame(tick);
    };
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      if (element.dataset.resizing === 'true') return;
      const rect = element.getBoundingClientRect();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1;
      const next = zoomPreviewAt(
        target.current ?? current.current,
        event.deltaY * unit,
        {
          x: event.clientX - rect.left - rect.width / 2,
          y: event.clientY - rect.top - rect.height / 2,
        }
      );
      setView(current.current);
      setMode('custom');
      if (reducedMotion.matches) {
        stop();
        current.current = next;
        setView(next);
        return;
      }
      target.current = next;
      if (animation.current === undefined) {
        previousTime = 0;
        animation.current = requestAnimationFrame(tick);
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', wheel);
      stop();
    };
  }, [stage, enabled]);

  const setPan = (value: SetStateAction<{ x: number; y: number }>) => {
    stop();
    const next = {
      ...current.current,
      pan: typeof value === 'function' ? value(current.current.pan) : value,
    };
    current.current = next;
    setView(next);
  };
  const setZoom = (value: 'fit' | 'actual') => {
    stop();
    const next = { scale: value === 'fit' ? fit : 1, pan: { x: 0, y: 0 } };
    current.current = next;
    setView(next);
    setMode(value);
  };
  const freeze = () => {
    stop();
    setView(current.current);
    setMode('custom');
    return current.current;
  };
  return { zoom: mode, scale, pan: view.pan, setPan, setZoom, freeze };
}
