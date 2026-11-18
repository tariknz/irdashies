import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

interface SettingsPopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  label: string;
  children: ReactNode;
  id?: string;
  role?: 'group' | 'listbox';
  matchAnchorWidth?: boolean;
  /** Narrowest the panel is drawn, unless it matches its anchor. */
  minWidth?: number;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/** A non-modal popup that stays inside the settings theme and viewport. */
export function SettingsPopover({
  open,
  anchorRef,
  onClose,
  label,
  children,
  id,
  role = 'group',
  matchAnchorWidth = false,
  minWidth = 200,
  initialFocusRef,
}: SettingsPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({
    visibility: 'hidden',
  });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !panelRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const panel = panelRef.current.getBoundingClientRect();
    const below = window.innerHeight - anchor.bottom - 12;
    const above = anchor.top - 12;
    const height = panelRef.current.scrollHeight + 2;
    const flip = height > below && above > below;
    const maxHeight = Math.max(36, flip ? above : below);
    const width = Math.min(
      window.innerWidth - 16,
      matchAnchorWidth ? anchor.width : Math.max(minWidth, panel.width)
    );
    setPosition({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
      top: flip
        ? Math.max(8, anchor.top - Math.min(height, maxHeight) - 4)
        : anchor.bottom + 4,
      width,
      maxHeight,
    });
  }, [open, anchorRef, matchAnchorWidth, minWidth]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current || position.visibility === 'hidden') return;
    const selected = panelRef.current.querySelector<HTMLElement>(
      '[aria-selected="true"], [aria-pressed="true"]'
    );
    const first = panelRef.current.querySelector<HTMLElement>(
      'button:not(:disabled), a[href]'
    );
    (initialFocusRef?.current ?? selected ?? first)?.focus();
  }, [open, position, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) =>
      target instanceof Node &&
      !panelRef.current?.contains(target) &&
      !anchorRef.current?.contains(target);
    const pointer = (event: PointerEvent) => {
      if (outside(event.target)) onClose();
    };
    const focus = (event: FocusEvent) => {
      if (outside(event.target)) onClose();
    };
    const scroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        if (panelRef.current?.contains(document.activeElement))
          anchorRef.current?.focus();
        onClose();
      }
    };
    const resize = () => {
      if (panelRef.current?.contains(document.activeElement))
        anchorRef.current?.focus();
      onClose();
    };
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('focusin', focus);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={label}
      style={position}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          anchorRef.current?.focus();
        } else if (event.key === 'Tab') {
          const controls = panelRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)'
          );
          const edge = event.shiftKey
            ? controls?.[0]
            : controls?.[controls.length - 1];
          if (document.activeElement !== edge) return;
          // Let native Tab continue from the field's place in the form.
          anchorRef.current?.focus();
          onClose();
        }
      }}
      className="fixed z-50 flex flex-col gap-1 overflow-y-auto rounded-md border border-settings-boundary bg-settings-control p-1 text-slate-200 shadow-xl"
    >
      {children}
    </div>,
    document.querySelector('.settings-shell') ?? document.body
  );
}
