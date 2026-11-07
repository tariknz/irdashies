import {
  lazy,
  Suspense,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { PreviewSettingsMenu } from './PreviewSettingsMenu';
import { GearSix, X } from '@phosphor-icons/react';
import logo from '@irdashies/frontend/assets/icons/logo.svg';

const SettingsLoader = lazy(() =>
  import('@irdashies/frontend/components/Settings/SettingsLoader').then(
    (module) => ({ default: module.SettingsLoader })
  )
);

interface SettingsContentProps {
  onClose: () => void;
}

function SettingsContent({ onClose }: SettingsContentProps) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [centered, setCentered] = useState(true);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previousPath.current !== pathname) mainRef.current?.focus();
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const modal = modalRef.current;
    document.body.style.overflow = 'hidden';
    modal?.showModal();
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      modal?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement)
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();

      let startPosX = position.x;
      let startPosY = position.y;

      if (centered && panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        startPosX = rect.left;
        startPosY = rect.top;
        setCentered(false);
        setPosition({ x: startPosX, y: startPosY });
      }

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX,
        startPosY,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setPosition({
          x: dragRef.current.startPosX + (ev.clientX - dragRef.current.startX),
          y: dragRef.current.startPosY + (ev.clientY - dragRef.current.startY),
        });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [position, centered]
  );

  useEffect(() => {
    return () => {
      dragRef.current = null;
    };
  }, []);

  return (
    // Fixed popovers use viewport coordinates. Keep this portal host free of
    // transforms, and centre the dialog with grid instead.
    <dialog
      ref={modalRef}
      aria-label="Preview settings"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="settings-shell fixed inset-0 m-0 hidden h-dvh max-h-none w-screen max-w-none place-items-center overflow-hidden overscroll-contain border-0 bg-transparent p-0 text-slate-200 open:grid backdrop:bg-black/60"
    >
      <div
        ref={panelRef}
        className="flex h-[min(800px,85vh)] w-[min(1280px,95vw)] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl"
        style={
          centered
            ? undefined
            : { position: 'absolute', top: position.y, left: position.x }
        }
      >
        {/* Header — drag handle */}
        <div
          className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-slate-700 px-5 py-3 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="" className="h-10 w-10 shrink-0" />
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[24px] font-semibold leading-7 tracking-[-0.04em] text-white">
                  ir<span className="text-red-600">Dashies</span>
                </span>
                <h1 className="text-sm font-medium text-slate-400">
                  {pathname === '/settings/general'
                    ? 'App settings'
                    : 'Overlay Settings'}
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Live preview · Sample data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex min-h-9 min-w-9 items-center justify-center rounded-md border border-settings-boundary bg-settings-control text-slate-300 transition-colors hover:bg-settings-hover hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu + Content */}
        <div className="flex min-h-0 flex-1">
          <PreviewSettingsMenu />
          <main
            ref={mainRef}
            tabIndex={-1}
            aria-label={
              pathname === '/settings/general'
                ? 'App settings page'
                : 'Overlay settings page'
            }
            className="min-w-0 flex-1 bg-slate-900 p-4 focus:outline-none lg:p-7"
          >
            <div className="mx-auto flex h-full max-w-[960px] flex-col overflow-hidden">
              <Suspense fallback={<p role="status">Loading settings...</p>}>
                <SettingsLoader previewMode />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </dialog>
  );
}

interface PreviewSettingsButtonProps {
  openToWidget?: string | null;
  onClose?: () => void;
}

export function PreviewSettingsButton({
  openToWidget,
  onClose,
}: PreviewSettingsButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = internalOpen || !!openToWidget;
  const initialRoute = `/settings/${openToWidget || 'standings'}`;

  const handleClose = () => {
    setInternalOpen(false);
    onClose?.();
  };

  return (
    <>
      <button
        onClick={() => setInternalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide text-white border border-red-600 bg-red-600/20 hover:bg-red-600/40 hover:border-red-500 transition-colors"
      >
        <GearSix size={12} weight="bold" />
        Configure
      </button>

      {isOpen && (
        <MemoryRouter initialEntries={[initialRoute]} key={initialRoute}>
          <Routes>
            <Route
              path="/settings/:widgetId"
              element={<SettingsContent onClose={handleClose} />}
            />
          </Routes>
        </MemoryRouter>
      )}
    </>
  );
}
