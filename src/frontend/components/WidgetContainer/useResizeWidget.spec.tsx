import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WidgetLayout } from '@irdashies/types';
import { useResizeWidget, type ResizeDirection } from './useResizeWidget';

const startResize = (layout: WidgetLayout, direction: ResizeDirection) => {
  const onLayoutChange = vi.fn();
  const { result } = renderHook(() =>
    useResizeWidget({ layout, onLayoutChange, enabled: true })
  );
  act(() =>
    result.current.getResizeHandleProps(direction).onPointerDown({
      clientX: 0,
      clientY: 0,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as unknown as PointerEvent<HTMLElement>)
  );
  return onLayoutChange;
};

describe('useResizeWidget', () => {
  it('saves a resized layout in whole pixels', () => {
    const onLayoutChange = startResize(
      { x: 0, y: 0, width: 300, height: 100 },
      'se'
    );
    // A scaled display moves the pointer in fractions of a pixel.
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 96.4, clientY: 19.6 })
      );
    });
    expect(onLayoutChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 396, height: 120 })
    );
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
  });

  it('keeps the opposite edges in place when resizing from the top left', () => {
    const onLayoutChange = startResize(
      { x: 100, y: 50, width: 300, height: 100 },
      'nw'
    );
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 0.5, clientY: 0.5 })
      );
    });
    // The right edge stays at 400 and the bottom at 150.
    expect(onLayoutChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 101, y: 51, width: 299, height: 99 })
    );
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
  });
});
