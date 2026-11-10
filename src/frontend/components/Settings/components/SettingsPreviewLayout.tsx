import { t } from '@irdashies/frontend/i18n';
import { useContext, useRef, useState, type ReactNode } from 'react';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useElementSize } from '@irdashies/context';
import { SettingsPreviewPanelContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';
import { WidgetPreview } from './WidgetPreview';

interface SettingsPreviewLayoutProps {
  widgetId: string;
  children: ReactNode;
  /** Embedded sections use their page's scrollbar. */
  scroll?: boolean;
}

/** Both columns must fit: 600px of settings, 320px of preview, and a gap. */
export const SettingsPreviewLayout = ({
  widgetId,
  children,
  scroll = true,
}: SettingsPreviewLayoutProps) => {
  const localWidth = useState(420);
  const [preferredWidth, setPreferredWidth] =
    useContext(SettingsPreviewPanelContext) ?? localWidth;
  const container = useRef<HTMLDivElement>(null);
  const { width: containerWidth } = useElementSize(container);
  const maxWidth = containerWidth
    ? Math.max(320, Math.floor(containerWidth) - 620)
    : Math.max(420, preferredWidth);
  const panelWidth = Math.min(maxWidth, Math.max(320, preferredWidth));
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(
    null
  );
  const [resizing, setResizing] = useState(false);
  const setWidth = (width: number) =>
    setPreferredWidth(Math.round(Math.max(320, Math.min(maxWidth, width))));

  return (
    <div
      ref={container}
      className={`@container/settings-preview min-h-0 min-w-0 pt-5 ${scroll ? 'flex-1' : ''}`}
      style={{ ['--preview-panel-width' as string]: `${panelWidth}px` }}
    >
      <div
        className={`grid min-w-0 grid-cols-1 gap-5 @[59rem]/settings-preview:grid-cols-[minmax(37.5rem,1fr)_var(--preview-panel-width)] @[59rem]/settings-preview:grid-rows-1 ${scroll ? 'h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]' : ''}`}
      >
        <aside
          aria-label={t('Widget preview')}
          className={`relative min-h-0 min-w-0 self-start @[59rem]/settings-preview:col-start-2 @[59rem]/settings-preview:row-start-1 ${scroll ? 'max-h-full @[59rem]/settings-preview:h-full' : 'sticky top-0'}`}
        >
          <div
            role="separator"
            aria-label={t('Resize preview panel')}
            aria-orientation="vertical"
            aria-valuemin={320}
            aria-valuemax={Math.floor(maxWidth)}
            aria-valuenow={Math.round(panelWidth)}
            tabIndex={0}
            title={t('Drag to resize preview panel; arrow keys adjust width')}
            className={`group absolute -left-5 top-0 bottom-0 hidden w-5 touch-none cursor-col-resize items-center justify-center outline-none @[59rem]/settings-preview:flex ${resizing ? 'text-accent-300' : 'text-slate-500 hover:text-accent-300 focus-visible:text-accent-300'}`}
            onPointerDown={(event) => {
              if (event.button !== 0 || drag.current) return;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                width: panelWidth,
              };
              setResizing(true);
            }}
            onPointerMove={(event) => {
              const start = drag.current;
              if (start?.pointerId === event.pointerId)
                setWidth(start.width + start.x - event.clientX);
            }}
            onPointerUp={(event) => {
              if (drag.current?.pointerId !== event.pointerId) return;
              event.currentTarget.releasePointerCapture(event.pointerId);
              drag.current = null;
              setResizing(false);
            }}
            onLostPointerCapture={() => {
              drag.current = null;
              setResizing(false);
            }}
            onDoubleClick={() => setPreferredWidth(420)}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 50 : 10;
              switch (event.key) {
                case 'ArrowLeft':
                  setWidth(panelWidth + step);
                  break;
                case 'ArrowRight':
                  setWidth(panelWidth - step);
                  break;
                case 'Home':
                  setWidth(320);
                  break;
                case 'End':
                  setWidth(maxWidth);
                  break;
                default:
                  return;
              }
              event.preventDefault();
            }}
          >
            <span className="absolute inset-y-0 left-1/2 w-px bg-slate-700 group-hover:bg-accent-400 group-focus-visible:bg-accent-400" />
            <span className="relative rounded-md border border-current bg-slate-900 py-2">
              <DotsSixVerticalIcon size={14} />
            </span>
          </div>
          <WidgetPreview
            key={widgetId}
            widgetId={widgetId}
            adaptive
            fillHeight={scroll}
          />
        </aside>
        <div
          className={`min-h-0 min-w-0 @[59rem]/settings-preview:col-start-1 @[59rem]/settings-preview:row-start-1 ${scroll ? 'overflow-y-auto pr-1 [scrollbar-gutter:stable]' : ''}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
