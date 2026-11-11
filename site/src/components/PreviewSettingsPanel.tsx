import { lazy, Suspense, useState, useRef, useEffect } from 'react';
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { PreviewSettingsMenu } from './PreviewSettingsMenu';
import { TrailingSlashRedirect } from '@irdashies/frontend/components/Settings/TrailingSlashRedirect';
import {
  ArrowsOutSimple,
  GearSix,
  List,
  Minus,
  X,
} from '@phosphor-icons/react';
import logo from '@irdashies/frontend/assets/icons/logo.svg';

const SettingsLoader = lazy(() =>
  import('@irdashies/frontend/components/Settings/SettingsLoader').then(
    (module) => ({ default: module.SettingsLoader })
  )
);

interface SettingsContentProps {
  onClose: () => void;
  request: PreviewSettingsRequest;
}

interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function fitPanel(
  bounds: PanelBounds,
  renderedSize?: Pick<PanelBounds, 'width' | 'height'>
): PanelBounds {
  const width = renderedSize
    ? bounds.width
    : Math.min(Math.max(440, bounds.width), window.innerWidth - 16);
  const height = renderedSize
    ? bounds.height
    : Math.min(Math.max(280, bounds.height), window.innerHeight - 16);
  // Keep the expanded size for restoration, but constrain only the visible bar.
  const visibleWidth = Math.min(
    window.innerWidth - 16,
    renderedSize?.width ?? width
  );
  const visibleHeight = Math.min(
    window.innerHeight - 16,
    renderedSize?.height ?? height
  );
  return {
    width,
    height,
    x: Math.max(8, Math.min(bounds.x, window.innerWidth - visibleWidth - 8)),
    y: Math.max(8, Math.min(bounds.y, window.innerHeight - visibleHeight - 8)),
  };
}

function SettingsContent({ onClose, request }: SettingsContentProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [bounds, setBounds] = useState(() =>
    fitPanel({ x: window.innerWidth - 656, y: 96, width: 640, height: 640 })
  );
  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const interactionRef = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    bounds: PanelBounds;
    renderedSize?: Pick<PanelBounds, 'width' | 'height'>;
  } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    // Menu navigation changes useNavigate's identity; only an open request
    // should select this target page again.
    navigateRef.current(`/settings/${request.widgetId}`, { replace: true });
    setBounds((previous) => fitPanel(previous));
    setMinimized(false);
    setMenuOpen(false);
  }, [request]);

  useEffect(() => {
    if (previousPath.current !== pathname) mainRef.current?.focus();
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (
        previousFocus instanceof HTMLElement &&
        (dialog?.contains(document.activeElement) ||
          document.activeElement === document.body)
      )
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const resize = () => {
      const renderedSize = minimized
        ? panelRef.current?.getBoundingClientRect()
        : undefined;
      setBounds((previous) => fitPanel(previous, renderedSize));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [minimized]);

  const startInteraction = (
    event: React.PointerEvent<HTMLElement>,
    mode: 'move' | 'resize'
  ) => {
    if (event.button !== 0) return;
    if (
      mode === 'move' &&
      event.target instanceof Element &&
      event.target.closest('button')
    )
      return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      bounds,
      renderedSize: minimized
        ? panelRef.current?.getBoundingClientRect()
        : undefined,
    };
  };

  const moveInteraction = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    const start = interaction.bounds;
    setBounds(
      fitPanel(
        interaction.mode === 'move'
          ? { ...start, x: start.x + dx, y: start.y + dy }
          : {
              ...start,
              width: Math.min(
                start.width + dx,
                window.innerWidth - start.x - 8
              ),
              height: Math.min(
                start.height + dy,
                window.innerHeight - start.y - 8
              ),
            },
        interaction.mode === 'move' ? interaction.renderedSize : undefined
      )
    );
  };

  const endInteraction = () => {
    interactionRef.current = null;
  };

  return (
    // Fixed popovers use viewport coordinates. Keep this portal host free of
    // transforms so dropdowns still line up after dragging the panel.
    <dialog
      ref={dialogRef}
      open
      aria-label="Preview settings"
      aria-modal="false"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="settings-shell pointer-events-none fixed inset-0 z-70 m-0 h-dvh max-h-none w-screen max-w-none overflow-visible border-0 bg-transparent p-0 text-slate-200 [&>*]:pointer-events-auto"
    >
      <div
        ref={panelRef}
        className="absolute flex max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl"
        style={{
          top: bounds.y,
          left: bounds.x,
          width: minimized ? Math.min(320, bounds.width) : bounds.width,
          height: minimized ? undefined : bounds.height,
        }}
      >
        {/* Header — drag handle */}
        <div
          className="flex min-h-14 shrink-0 touch-none items-center justify-between gap-2 border-b border-slate-700 px-3 py-2 cursor-move select-none"
          onPointerDown={(event) => startInteraction(event, 'move')}
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          onLostPointerCapture={endInteraction}
        >
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt=""
              draggable={false}
              className="h-7 w-7 shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-lg font-semibold leading-6 tracking-[-0.04em] text-white">
                  ir<span className="text-red-600">Dashies</span>
                </span>
                <h1
                  className={
                    minimized ? 'sr-only' : 'text-xs font-medium text-slate-400'
                  }
                >
                  {pathname === '/settings/general'
                    ? 'App settings'
                    : 'Overlay Settings'}
                </h1>
              </div>
              <p className={minimized ? 'sr-only' : 'text-xs text-slate-400'}>
                Changes appear live. Drag to move.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => {
                if (minimized) setBounds((previous) => fitPanel(previous));
                setMinimized((previous) => !previous);
              }}
              aria-label={minimized ? 'Restore settings' : 'Minimize settings'}
              title={
                minimized
                  ? 'Restore settings'
                  : 'Minimize settings to see the preview'
              }
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-slate-300 hover:bg-settings-hover hover:text-white"
            >
              {minimized ? <ArrowsOutSimple size={18} /> : <Minus size={18} />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md border border-settings-boundary bg-settings-control text-slate-300 transition-colors hover:bg-settings-hover hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Menu + Content */}
        <div
          hidden={minimized}
          className={minimized ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}
        >
          <div className="flex shrink-0 items-center border-b border-slate-700 px-3 py-1.5">
            <button
              aria-expanded={menuOpen}
              aria-controls="preview-settings-menu"
              onClick={() => setMenuOpen((previous) => !previous)}
              className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-slate-300 hover:bg-settings-hover hover:text-white"
            >
              <List size={18} />
              Choose widget
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1">
            <div
              id="preview-settings-menu"
              hidden={!menuOpen}
              className={
                menuOpen
                  ? 'absolute inset-y-0 left-0 z-10 flex shadow-xl'
                  : 'hidden'
              }
              onClick={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest('a')
                )
                  setMenuOpen(false);
              }}
            >
              <PreviewSettingsMenu />
            </div>
            <main
              ref={mainRef}
              tabIndex={-1}
              aria-label={
                pathname === '/settings/general'
                  ? 'App settings page'
                  : 'Overlay settings page'
              }
              className="min-w-0 flex-1 bg-slate-900 p-4 focus:outline-none"
            >
              <div className="mx-auto flex h-full max-w-[960px] flex-col overflow-hidden">
                <Suspense fallback={<p role="status">Loading settings...</p>}>
                  <SettingsLoader previewMode />
                </Suspense>
              </div>
            </main>
          </div>
        </div>
        {!minimized && (
          <button
            aria-label="Resize settings"
            title="Drag to resize, or use arrow keys"
            className="absolute bottom-0 right-0 flex h-6 w-6 touch-none cursor-se-resize items-end justify-end rounded-tl bg-slate-950 text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-accent-400"
            onPointerDown={(event) => startInteraction(event, 'resize')}
            onPointerMove={moveInteraction}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
            onLostPointerCapture={endInteraction}
            onKeyDown={(event) => {
              const dx =
                event.key === 'ArrowRight'
                  ? 20
                  : event.key === 'ArrowLeft'
                    ? -20
                    : 0;
              const dy =
                event.key === 'ArrowDown'
                  ? 20
                  : event.key === 'ArrowUp'
                    ? -20
                    : 0;
              if (!dx && !dy) return;
              event.preventDefault();
              setBounds((previous) =>
                fitPanel({
                  ...previous,
                  width: previous.width + dx,
                  height: previous.height + dy,
                })
              );
            }}
          >
            <ArrowsOutSimple size={16} />
          </button>
        )}
      </div>
    </dialog>
  );
}

export interface PreviewSettingsRequest {
  widgetId: string;
}

interface PreviewSettingsButtonProps {
  /** A new object represents each gear click, including repeated widget IDs. */
  openRequest?: PreviewSettingsRequest | null;
  defaultWidget?: string;
  onClose?: () => void;
}

export function PreviewSettingsButton({
  openRequest,
  defaultWidget = 'relative',
  onClose,
}: PreviewSettingsButtonProps) {
  const [request, setRequest] = useState<PreviewSettingsRequest | null>(
    openRequest ?? null
  );
  useEffect(() => {
    setRequest(openRequest ?? null);
  }, [openRequest]);

  const handleClose = () => {
    setRequest(null);
    onClose?.();
  };

  return (
    <>
      <button
        onClick={() => setRequest({ widgetId: defaultWidget })}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide text-white border border-red-600 bg-red-600/20 hover:bg-red-600/40 hover:border-red-500 transition-colors"
      >
        <GearSix size={12} weight="bold" />
        Configure
      </button>

      {request && (
        <MemoryRouter initialEntries={[`/settings/${request.widgetId}`]}>
          <Routes>
            <Route
              path="/settings/:widgetId"
              element={
                <TrailingSlashRedirect>
                  <SettingsContent onClose={handleClose} request={request} />
                </TrailingSlashRedirect>
              }
            />
          </Routes>
        </MemoryRouter>
      )}
    </>
  );
}
