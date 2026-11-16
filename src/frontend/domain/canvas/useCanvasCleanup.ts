import { useLayoutEffect, type RefObject } from 'react';

export function useCanvasCleanup(
  ref: RefObject<HTMLCanvasElement | null>,
  cacheRef?: RefObject<HTMLCanvasElement | null>
): void {
  useLayoutEffect(() => {
    const canvas = ref.current;
    return () => {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      const cache = cacheRef?.current;
      if (cache) {
        cache.width = 0;
        cache.height = 0;
        cacheRef.current = null;
      }
    };
  }, [ref, cacheRef]);
}
