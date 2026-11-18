import { useLayoutEffect, useRef, StrictMode } from 'react';
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useCanvasCleanup } from './useCanvasCleanup';

it('releases visible and cached pixel buffers even while detached nodes are retained', () => {
  const cache = document.createElement('canvas');
  cache.width = 1600;
  cache.height = 1200;
  function Widget() {
    const ref = useRef<HTMLCanvasElement>(null);
    const cacheRef = useRef<HTMLCanvasElement | null>(null);
    useCanvasCleanup(ref, cacheRef);
    useLayoutEffect(() => {
      cacheRef.current = cache;
    }, []);
    return <canvas ref={ref} width={1600} height={1200} />;
  }
  const result = render(<Widget />);
  const retained = result.container.querySelector('canvas');
  if (!retained) throw new Error('Canvas did not mount');
  result.unmount();
  expect([retained.width, retained.height, cache.width, cache.height]).toEqual([
    0, 0, 0, 0,
  ]);
});

it('lets the owner size and draw again after StrictMode effect cleanup', () => {
  function Widget() {
    const ref = useRef<HTMLCanvasElement>(null);
    useCanvasCleanup(ref);
    useLayoutEffect(() => {
      if (!ref.current) return;
      ref.current.width = 400;
      ref.current.height = 200;
    }, []);
    return <canvas ref={ref} />;
  }
  const result = render(
    <StrictMode>
      <Widget />
    </StrictMode>
  );
  const canvas = result.container.querySelector('canvas');
  if (!canvas) throw new Error('Canvas did not mount');
  expect([canvas.width, canvas.height]).toEqual([400, 200]);
  result.unmount();
  expect([canvas.width, canvas.height]).toEqual([0, 0]);
});
