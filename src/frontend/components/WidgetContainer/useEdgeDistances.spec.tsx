import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboard } from '@irdashies/context';
import { useEdgeDistances } from './useEdgeDistances';

vi.mock('@irdashies/context', () => ({
  useDashboard: vi.fn(),
}));

const mockUseDashboard = vi.mocked(useDashboard);
const mockDashboardContext = (
  context: Partial<ReturnType<typeof useDashboard>>
) => context as unknown as ReturnType<typeof useDashboard>;

const displayBounds = {
  x: -1920,
  y: 0,
  width: 1920,
  height: 1080,
};

describe('useEdgeDistances', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(
      mockDashboardContext({
        containerBoundsInfo: {
          displayBounds,
          expected: displayBounds,
          actual: displayBounds,
          offset: { x: 0, y: 0 },
        },
      })
    );
  });

  it('calculates distances from each widget edge to the display bounds', () => {
    const { result } = renderHook(() =>
      useEdgeDistances({ x: -1800, y: 40, width: 300, height: 120 })
    );

    expect(result.current).toEqual({
      left: 120,
      top: 40,
      right: 1500,
      bottom: 920,
    });
  });

  it('returns null when display bounds are unavailable', () => {
    mockUseDashboard.mockReturnValue(
      mockDashboardContext({
        containerBoundsInfo: undefined,
      })
    );

    const { result } = renderHook(() =>
      useEdgeDistances({ x: 10, y: 20, width: 300, height: 120 })
    );

    expect(result.current).toBeNull();
  });

  it('returns null when disabled', () => {
    const { result } = renderHook(() =>
      useEdgeDistances({ x: -1800, y: 40, width: 300, height: 120 }, false)
    );

    expect(result.current).toBeNull();
  });
});
