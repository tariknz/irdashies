import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGearFlash } from './useGearFlash';

const UP = '#22c55e';
const DOWN = '#ef4444';

const setup = (gear: number | undefined, enabled = true) =>
  renderHook(({ g, e }) => useGearFlash(g, e, UP, DOWN), {
    initialProps: { g: gear, e: enabled },
  });

describe('useGearFlash', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not flash on first render', () => {
    expect(setup(3).result.current).toBeUndefined();
  });

  it('flashes the up colour on an upshift, then clears', () => {
    const { result, rerender } = setup(3);
    rerender({ g: 4, e: true });
    expect(result.current).toBe(UP);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBeUndefined();
  });

  it('flashes the down colour on a downshift', () => {
    const { result, rerender } = setup(4);
    rerender({ g: 3, e: true });
    expect(result.current).toBe(DOWN);
  });

  it('ignores neutral and reverse', () => {
    const { result, rerender } = setup(0);
    rerender({ g: 1, e: true });
    expect(result.current).toBeUndefined();
    rerender({ g: 0, e: true });
    expect(result.current).toBeUndefined();
  });

  it('flashes a shift that passes through neutral', () => {
    const { result, rerender } = setup(3);
    rerender({ g: 0, e: true });
    expect(result.current).toBeUndefined();
    rerender({ g: 4, e: true });
    expect(result.current).toBe(UP);
  });

  it('drops the colour at once when neutral arrives, or when disabled', () => {
    const { result, rerender } = setup(3);
    rerender({ g: 4, e: true });
    rerender({ g: 0, e: true });
    expect(result.current).toBeUndefined();
    rerender({ g: 3, e: true });
    expect(result.current).toBe(DOWN);
    rerender({ g: 3, e: false });
    rerender({ g: 3, e: true });
    expect(result.current).toBeUndefined();
  });

  it('does not flash the first gear after a session boundary', () => {
    const { result, rerender } = setup(5);
    rerender({ g: undefined, e: true });
    rerender({ g: 1, e: true });
    expect(result.current).toBeUndefined();
  });

  it('clears even when neutral arrives during the flash', () => {
    const { result, rerender } = setup(3);
    rerender({ g: 4, e: true });
    rerender({ g: 0, e: true });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBeUndefined();
  });

  it('a second shift inside the window switches colour and restarts the timer', () => {
    const { result, rerender } = setup(4);
    rerender({ g: 5, e: true });
    act(() => vi.advanceTimersByTime(200));
    rerender({ g: 4, e: true });
    expect(result.current).toBe(DOWN);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(DOWN);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBeUndefined();
  });

  it('does nothing when disabled', () => {
    const { result, rerender } = setup(3, false);
    rerender({ g: 4, e: false });
    expect(result.current).toBeUndefined();
  });
});
