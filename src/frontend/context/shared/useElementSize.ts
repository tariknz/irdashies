import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

const EMPTY: ElementSize = { width: 0, height: 0 };

/**
 * Tracks an element's rendered size with a ResizeObserver.
 *
 * Observes the element and its parent, because a flex child can keep its own
 * box while the parent resizes around it. Updates are debounced so a drag
 * resize does not re-render on every frame.
 */
export const useElementSize = (
  ref: RefObject<HTMLElement | null>,
  debounceMs = 50
): ElementSize => {
  const [size, setSize] = useState<ElementSize>(EMPTY);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize((previous) =>
        previous.width === rect.width && previous.height === rect.height
          ? previous
          : { width: rect.width, height: rect.height }
      );
    };

    measure();

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(measure, debounceMs);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener('resize', schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (timer) clearTimeout(timer);
    };
  }, [ref, debounceMs]);

  return size;
};
