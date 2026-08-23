import React, {
  cloneElement,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { clampToBounds, placeVertically } from './tooltipPosition';

type Placement = 'top' | 'bottom';

interface TriggerProps {
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
  onFocus?: React.FocusEventHandler<HTMLElement>;
  onBlur?: React.FocusEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  'aria-describedby'?: string;
}

export interface TooltipProps {
  /** Explanatory text. Keep it to one or two short sentences. */
  content: React.ReactNode;
  /** Preferred side. Flips automatically when there is no room. */
  placement?: Placement;
  /** Hover open delay. Focus always opens immediately. */
  delayMs?: number;
  /**
   * Single element that owns the pointer/focus events. Wrap disabled controls
   * in a plain span, because disabled elements emit no mouse events.
   */
  children: React.ReactElement<TriggerProps>;
}

const DEFAULT_DELAY_MS = 350;

export const Tooltip = memo(
  ({
    content,
    placement = 'top',
    delayMs = DEFAULT_DELAY_MS,
    children,
  }: TooltipProps) => {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{
      left: number;
      top: number;
    } | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const tipRef = useRef<HTMLDivElement | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    const close = useCallback(() => {
      clearTimer();
      setOpen(false);
      setPosition(null);
    }, [clearTimer]);

    const openNow = useCallback(
      (trigger: HTMLElement) => {
        clearTimer();
        triggerRef.current = trigger;
        setOpen(true);
      },
      [clearTimer]
    );

    const openAfterDelay = useCallback(
      (trigger: HTMLElement) => {
        clearTimer();
        triggerRef.current = trigger;
        timerRef.current = setTimeout(() => setOpen(true), delayMs);
      },
      [clearTimer, delayMs]
    );

    useEffect(() => clearTimer, [clearTimer]);

    // The Gantry is full of overflow-hidden panels, so the surface is portalled
    // to the body and placed from the trigger rect rather than laid out inline.
    useLayoutEffect(() => {
      if (!open) return;
      const trigger = triggerRef.current;
      const tip = tipRef.current;
      if (!trigger || !tip) return;

      const anchor = trigger.getBoundingClientRect();
      const { width, height } = tip.getBoundingClientRect();
      const bounds = { width: window.innerWidth, height: window.innerHeight };

      setPosition(
        clampToBounds(
          {
            left: anchor.left + anchor.width / 2 - width / 2,
            top: placeVertically(anchor, height, placement, bounds.height),
          },
          { width, height },
          bounds
        )
      );
    }, [open, placement, content]);

    useEffect(() => {
      if (!open) return;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') close();
      };
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('scroll', close, true);
        window.removeEventListener('resize', close);
      };
    }, [open, close]);

    const childProps = children.props;
    const trigger = cloneElement(children, {
      'aria-describedby': open ? id : childProps['aria-describedby'],
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
        childProps.onMouseEnter?.(event);
        openAfterDelay(event.currentTarget);
      },
      onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
        childProps.onMouseLeave?.(event);
        close();
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        childProps.onFocus?.(event);
        openNow(event.currentTarget);
      },
      onBlur: (event: React.FocusEvent<HTMLElement>) => {
        childProps.onBlur?.(event);
        close();
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        childProps.onKeyDown?.(event);
        if (event.key === 'Escape') close();
      },
    });

    return (
      <>
        {trigger}
        {open &&
          createPortal(
            <div
              ref={tipRef}
              id={id}
              role="tooltip"
              className="fixed z-50 pointer-events-none max-w-xs bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white shadow-lg"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              {content}
            </div>,
            document.body
          )}
      </>
    );
  }
);
Tooltip.displayName = 'Tooltip';
