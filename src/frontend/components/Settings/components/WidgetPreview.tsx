import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsInIcon,
  ArrowsOutIcon,
  PauseIcon,
  PlayIcon,
  ArrowCounterClockwiseIcon,
} from '@phosphor-icons/react';
import { useDashboard, useElementSize } from '@irdashies/context';
import { getWidgetManifest } from '@irdashies/types';
import {
  previewFitScale,
  resolvePreviewWidget,
} from '@irdashies/domain/widgetPreview/presentation';
import { usePreviewViewport } from './usePreviewViewport';
import { usePreviewResize } from './usePreviewResize';
import { useWidgetPreviewSession } from './useWidgetPreviewSession';
import { ResizeHandles } from '@irdashies/domain/widgetPresentation/ResizeHandle';

export const WidgetPreview = ({
  widgetId,
  adaptive = false,
  fillHeight = false,
}: {
  widgetId: string;
  adaptive?: boolean;
  fillHeight?: boolean;
}) => {
  const { currentDashboard } = useDashboard();
  const widget = useMemo(
    () => currentDashboard && resolvePreviewWidget(currentDashboard, widgetId),
    [currentDashboard, widgetId]
  );
  const [frameSize, setFrameSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  // The saved layout can be fractional: edit mode moves and resizes widgets
  // by pointer deltas, which on a scaled display are fractions of a CSS
  // pixel. The preview works in whole pixels, as its own resize does.
  const savedWidth = Math.round(widget?.layout.width ?? 1);
  const savedHeight = Math.round(widget?.layout.height ?? 1);
  const width = frameSize?.width ?? savedWidth;
  const height = frameSize?.height ?? savedHeight;
  const previewConfigDashboard = useMemo(() => {
    if (!currentDashboard || !widget || !frameSize) return currentDashboard;
    const selected = { ...widget, layout: { ...widget.layout, ...frameSize } };
    return {
      ...currentDashboard,
      widgets: [
        ...currentDashboard.widgets.filter((other) => other.id !== selected.id),
        selected,
      ],
    };
  }, [currentDashboard, widget, frameSize]);
  const preview = useWidgetPreviewSession(widgetId, previewConfigDashboard);
  const stage = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modal = useRef(false);
  const size = useElementSize(stage);
  const [expanded, setExpanded] = useState(false);
  const [light, setLight] = useState(false);
  const [panning, setPanning] = useState(false);
  const [resizeHovered, setResizeHovered] = useState(false);
  const [resizeFocused, setResizeFocused] = useState(false);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    origin: { x: number; y: number };
  } | null>(null);
  const fit = widget
    ? previewFitScale(width, height, size.width - 32, size.height - 32)
    : 1;
  const { zoom, scale, pan, setPan, setZoom, freeze } = usePreviewViewport(
    stage,
    fit,
    preview.renderFrame
  );
  const { resizing, getResizeHandleProps } = usePreviewResize({
    width,
    height,
    enabled: preview.renderFrame,
    freeze,
    setPan,
    onSizeChange: setFrameSize,
  });
  useEffect(() => {
    setFrameSize(null);
  }, [widgetId, widget?.layout.width, widget?.layout.height]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded) {
      element.close();
      element.showModal();
      modal.current = true;
    } else if (modal.current) {
      element.close();
      element.show();
      modal.current = false;
    } else if (!element.open) element.show();
  }, [expanded]);

  if (!widget) return null;
  const name = getWidgetManifest(widget.type ?? widget.id)?.name ?? widget.id;
  const button =
    'rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 focus-visible:outline-accent-400 aria-pressed:bg-slate-700 aria-pressed:text-white';
  const stageLayout = expanded
    ? 'min-h-0 flex-1'
    : adaptive
      ? `[height:clamp(8rem,min(var(--preview-native-height),calc((100cqw_-_2rem)_*_var(--preview-ratio)_+_2rem)),15rem)] ${fillHeight ? '@[59rem]/settings-preview:h-auto @[59rem]/settings-preview:min-h-0 @[59rem]/settings-preview:flex-1' : '@[59rem]/settings-preview:[height:clamp(8rem,min(var(--preview-native-height),calc((100cqw_-_2rem)_*_var(--preview-ratio)_+_2rem)),max(8rem,calc(100dvh_-_22rem)))]'}`
      : 'h-60';

  return (
    <dialog
      ref={dialog}
      open
      aria-label={`${name} preview`}
      onCancel={(event) => {
        event.preventDefault();
        setExpanded(false);
      }}
      className={`@container/widget-preview ${expanded ? 'fixed inset-x-5 bottom-5 top-[calc(max(40px,env(titlebar-area-height,40px))+1rem)] z-50 m-0 flex h-auto max-h-none w-[calc(100vw-40px)] max-w-none flex-col' : `relative m-0 block w-full max-w-none ${fillHeight ? '@[59rem]/settings-preview:flex @[59rem]/settings-preview:h-full @[59rem]/settings-preview:flex-col' : ''}`} overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-0 text-slate-200 backdrop:bg-black/70`}
      style={{
        ['--preview-ratio' as string]: height / width,
        ['--preview-native-height' as string]: `${height + 32}px`,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          Preview{' '}
          <span className="rounded bg-accent-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent-300">
            Demo
          </span>
          <span className="text-xs font-normal text-slate-400">
            {width} × {height} · {Math.round(scale * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={button}
            aria-pressed={zoom === 'fit'}
            title="Fit and center preview"
            onClick={() => setZoom('fit')}
          >
            Fit
          </button>
          <button
            type="button"
            className={button}
            aria-pressed={zoom === 'actual'}
            onClick={() => setZoom('actual')}
          >
            100%
          </button>
          <button
            type="button"
            className={button}
            aria-label="Light preview background"
            aria-pressed={light}
            onClick={() => setLight(!light)}
          >
            Background
          </button>
          <button
            type="button"
            className={button}
            aria-label={preview.playing ? 'Pause preview' : 'Play preview'}
            onClick={preview.togglePlaying}
          >
            {preview.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <button
            type="button"
            className={button}
            aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ArrowsInIcon size={16} />
            ) : (
              <ArrowsOutIcon size={16} />
            )}
          </button>
        </div>
      </div>
      <div
        ref={stage}
        role="region"
        aria-label={`${name} preview canvas`}
        aria-description="Scroll to zoom. Drag to pan. Use arrow keys to move and Home to center."
        data-resizing={resizing || panning || undefined}
        tabIndex={0}
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            drag.current ||
            resizing ||
            !preview.renderFrame
          )
            return;
          event.preventDefault();
          freeze();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            origin: pan,
          };
          setPanning(true);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || event.pointerId !== start.pointerId) return;
          setPan({
            x: start.origin.x + event.clientX - start.x,
            y: start.origin.y + event.clientY - start.y,
          });
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
          setPanning(false);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setPanning(false);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 128 : 32;
          switch (event.key) {
            case 'ArrowLeft':
              setPan((current) => ({ ...current, x: current.x - step }));
              break;
            case 'ArrowRight':
              setPan((current) => ({ ...current, x: current.x + step }));
              break;
            case 'ArrowUp':
              setPan((current) => ({ ...current, y: current.y - step }));
              break;
            case 'ArrowDown':
              setPan((current) => ({ ...current, y: current.y + step }));
              break;
            case 'Home':
              setPan({ x: 0, y: 0 });
              break;
            default:
              return;
          }
          event.preventDefault();
        }}
        className={`relative touch-none select-none overflow-hidden outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-accent-400 ${panning ? 'cursor-grabbing' : 'cursor-grab'} ${stageLayout} ${light ? 'bg-slate-300' : 'bg-slate-950'}`}
      >
        {preview.renderFrame ? (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-1 grid-rows-1 place-items-center">
            <div
              className="pointer-events-auto relative shrink-0"
              onPointerEnter={() => setResizeHovered(true)}
              onPointerLeave={() => setResizeHovered(false)}
              onFocusCapture={(event) =>
                setResizeFocused(event.target.matches(':focus-visible'))
              }
              onBlurCapture={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setResizeFocused(false);
              }}
              style={{
                width: width * scale,
                height: height * scale,
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}
            >
              <iframe
                ref={preview.ref}
                title={`${name} demo`}
                onLoad={preview.onLoad}
                src={
                  new URL('index-widget-preview.html', window.location.href)
                    .href
                }
                sandbox="allow-scripts allow-same-origin"
                tabIndex={-1}
                inert
                className={`absolute left-0 top-0 origin-top-left border-0 bg-transparent ${preview.loaded && preview.pictured ? '' : 'invisible'}`}
                style={{
                  width,
                  height,
                  transform: `scale(${scale})`,
                  pointerEvents: 'none',
                }}
              />
              <div
                className={`pointer-events-none absolute inset-0 border border-dashed border-sky-500/80 transition-opacity ${resizeHovered || resizeFocused || resizing ? 'opacity-100' : 'opacity-0'}`}
              />
              <ResizeHandles
                getResizeHandleProps={getResizeHandleProps}
                visible={resizeHovered || resizeFocused || resizing}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex h-full items-center justify-center gap-3 p-6 text-center text-sm text-slate-400"
            role="status"
          >
            {preview.error || 'Preview is available in the desktop app.'}
            {preview.error && (
              <button type="button" className={button} onClick={preview.retry}>
                Try again
              </button>
            )}
          </div>
        )}
        {preview.loading && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400"
            role="status"
          >
            Loading preview…
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-slate-700 px-3 py-1.5 text-xs text-slate-400">
        <p className="flex-1">
          Scroll to zoom. Drag to pan. Edges resize the demo frame. Sample data;
          session visibility filters are ignored. Your overlay layout is
          unchanged.
        </p>
        <button
          type="button"
          className={button}
          aria-label="Reset preview size"
          title="Restore saved widget dimensions"
          disabled={width === savedWidth && height === savedHeight}
          onClick={() => {
            setFrameSize(null);
            setZoom('fit');
          }}
        >
          <ArrowCounterClockwiseIcon size={16} />
        </button>
      </div>
    </dialog>
  );
};
