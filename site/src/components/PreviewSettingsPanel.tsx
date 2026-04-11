import { useState, useRef, useCallback, useEffect } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PreviewSettingsMenu } from './PreviewSettingsMenu';
import { SettingsLoader } from '../../../src/frontend/components/Settings/SettingsLoader';
import { GearSix, X } from '@phosphor-icons/react';

interface SettingsContentProps {
  onClose: () => void;
  activeWidgets: Set<string>;
  onToggleWidget: (id: string) => void;
}

function SettingsContent({
  onClose,
  activeWidgets,
  onToggleWidget,
}: SettingsContentProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [centered, setCentered] = useState(true);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  const panelStyle = centered
    ? {
        width: 900,
        height: 620,
        maxWidth: '95vw',
        maxHeight: '85vh',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    : {
        width: 900,
        height: 620,
        maxWidth: '95vw',
        maxHeight: '85vh',
        top: position.y,
        left: position.x,
      };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col"
      style={panelStyle}
    >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-none cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">
          Settings
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Menu + Content */}
      <div className="flex flex-1 min-h-0 p-3 gap-3 text-sm">
        <PreviewSettingsMenu
          activeWidgets={activeWidgets}
          onToggleWidget={onToggleWidget}
        />
        <div className="flex-1 overflow-y-auto min-h-0">
          <SettingsLoader previewMode />
        </div>
      </div>
    </div>
  );
}

interface PreviewSettingsButtonProps {
  activeWidgets: Set<string>;
  onToggleWidget: (id: string) => void;
  openToWidget?: string | null;
  onClose?: () => void;
}

export function PreviewSettingsButton({
  activeWidgets,
  onToggleWidget,
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
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide text-red-600 border border-red-600/40 bg-red-600/5 hover:bg-red-600/15 hover:border-red-600/60 transition-colors"
      >
        <GearSix size={12} weight="bold" />
        Configure
      </button>

      {isOpen && (
        <MemoryRouter initialEntries={[initialRoute]} key={initialRoute}>
          <Routes>
            <Route
              path="/settings/:widgetId"
              element={
                <SettingsContent
                  onClose={handleClose}
                  activeWidgets={activeWidgets}
                  onToggleWidget={onToggleWidget}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      )}
    </>
  );
}
