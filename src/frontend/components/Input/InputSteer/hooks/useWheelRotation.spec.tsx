import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useWheelRotation } from './useWheelRotation';

describe('useWheelRotation', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWheelRotation(0));
    
    expect(result.current.totalRotations).toBe(0);
    expect(result.current.hasRotatedOver360).toBe(false);
    expect(result.current.rotationDirection).toBe('none');
  });

  it('should track clockwise rotation', () => {
    const { result, rerender } = renderHook((angle) => useWheelRotation(angle), {
      initialProps: 0,
    });

    // Simulate clockwise rotation
    rerender(Math.PI / 2); // 90 degrees
    rerender(Math.PI); // 180 degrees
    rerender(3 * Math.PI / 2); // 270 degrees
    rerender(2 * Math.PI); // 360 degrees

    expect(result.current.totalRotations).toBe(1);
    expect(result.current.hasRotatedOver360).toBe(true);
  });

  it('should track counterclockwise rotation', () => {
    const { result, rerender } = renderHook((angle) => useWheelRotation(angle), {
      initialProps: 0,
    });

    // Simulate counterclockwise rotation
    rerender(-Math.PI / 2); // -90 degrees
    rerender(-Math.PI); // -180 degrees
    rerender(-3 * Math.PI / 2); // -270 degrees
    rerender(-2 * Math.PI); // -360 degrees

    expect(result.current.totalRotations).toBe(1);
    expect(result.current.hasRotatedOver360).toBe(true);
  });

  it('should handle multiple rotations', () => {
    const { result, rerender } = renderHook((angle) => useWheelRotation(angle), {
      initialProps: 0,
    });

    // Simulate 2.5 rotations clockwise
    rerender(Math.PI / 2);
    rerender(Math.PI);
    rerender(3 * Math.PI / 2);
    rerender(2 * Math.PI);
    rerender(5 * Math.PI / 2);
    rerender(3 * Math.PI);
    rerender(7 * Math.PI / 2);
    rerender(4 * Math.PI);
    rerender(9 * Math.PI / 2);

    expect(result.current.totalRotations).toBe(2);
    expect(result.current.hasRotatedOver360).toBe(true);
  });

  it('should handle angle wraparound', () => {
    const { result, rerender } = renderHook((angle) => useWheelRotation(angle), {
      initialProps: 0,
    });

    // Simulate rotation that crosses the ±π boundary
    rerender(Math.PI - 0.1);
    rerender(Math.PI + 0.1); // Crosses the boundary

    expect(result.current.rotationDirection).toBe('clockwise');
  });
}); 