import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useResizeWidget } from './useResizeWidget';

describe('useResizeWidget', () => {
  it('saves a resized layout in whole pixels', () => {
    const onLayoutChange = vi.fn();
    const { result } = renderHook(() =>
      useResizeWidget({
        layout: { x: 0, y: 0, width: 300, height: 100 },
        onLayoutChange,
        enabled: true,
      })
    );
    act(() =>
      result.current.getResizeHandleProps('se').onPointerDown({
        clientX: 0,
        clientY: 0,
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as PointerEvent<HTMLElement>)
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
});
