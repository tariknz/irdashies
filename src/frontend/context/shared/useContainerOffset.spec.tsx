import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useContainerOffset } from './useContainerOffset';
import * as DashboardContext from '../DashboardContext/DashboardContext';

vi.mock('../DashboardContext/DashboardContext', () => ({
  useDashboard: vi.fn(),
}));

describe('useContainerOffset', () => {
  it('returns zero offset when containerBoundsInfo is null', () => {
    vi.mocked(DashboardContext.useDashboard).mockReturnValue({
      containerBoundsInfo: null,
    } as ReturnType<typeof DashboardContext.useDashboard>);

    const { result } = renderHook(() => useContainerOffset());

    expect(result.current).toEqual({ x: 0, y: 0 });
  });

  it('returns correct offset for single monitor at origin', () => {
    vi.mocked(DashboardContext.useDashboard).mockReturnValue({
      containerBoundsInfo: {
        expected: { x: 0, y: 0, width: 1920, height: 1080 },
        actual: { x: 0, y: 0, width: 1920, height: 1080 },
        offset: { x: 0, y: 0 },
      },
    } as ReturnType<typeof DashboardContext.useDashboard>);

    const { result } = renderHook(() => useContainerOffset());

    expect(result.current).toEqual({ x: 0, y: 0 });
  });

  it('returns correct offset for multi-monitor with secondary to the left', () => {
    // Container spans from x=-1920 (secondary monitor) to x=1920 (end of primary)
    vi.mocked(DashboardContext.useDashboard).mockReturnValue({
      containerBoundsInfo: {
        expected: { x: -1920, y: 0, width: 3840, height: 1080 },
        actual: { x: -1920, y: 0, width: 3840, height: 1080 },
        offset: { x: 0, y: 0 },
      },
    } as ReturnType<typeof DashboardContext.useDashboard>);

    const { result } = renderHook(() => useContainerOffset());

    // Offset should negate the container's negative origin
    // Widget at x=100 (screen space) needs to be at x=100-(-1920)=2020 (container space)
    expect(result.current).toEqual({ x: 1920, y: 0 });
  });

  it('returns correct offset for multi-monitor with secondary above', () => {
    // Container spans from y=-1080 (secondary above) to y=1080 (end of primary)
    vi.mocked(DashboardContext.useDashboard).mockReturnValue({
      containerBoundsInfo: {
        expected: { x: 0, y: -1080, width: 1920, height: 2160 },
        actual: { x: 0, y: -1080, width: 1920, height: 2160 },
        offset: { x: 0, y: 0 },
      },
    } as ReturnType<typeof DashboardContext.useDashboard>);

    const { result } = renderHook(() => useContainerOffset());

    expect(result.current).toEqual({ x: 0, y: 1080 });
  });

  it('returns correct offset for complex multi-monitor setup', () => {
    // Container origin at (-1920, -1080) with monitors in multiple positions
    vi.mocked(DashboardContext.useDashboard).mockReturnValue({
      containerBoundsInfo: {
        expected: { x: -1920, y: -1080, width: 5760, height: 3240 },
        actual: { x: -1920, y: -1080, width: 5760, height: 3240 },
        offset: { x: 0, y: 0 },
      },
    } as ReturnType<typeof DashboardContext.useDashboard>);

    const { result } = renderHook(() => useContainerOffset());

    expect(result.current).toEqual({ x: 1920, y: 1080 });
  });
});
