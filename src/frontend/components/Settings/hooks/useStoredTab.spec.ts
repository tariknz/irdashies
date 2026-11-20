import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStoredTab } from './useStoredTab';

const TABS = ['look', 'options', 'visibility'] as const;

describe('useStoredTab', () => {
  beforeEach(() => localStorage.clear());

  it('opens on the first tab when none was kept', () => {
    const { result } = renderHook(() => useStoredTab('pageTab', TABS));
    expect(result.current[0]).toBe('look');
  });

  it('keeps the tab picked for next time', () => {
    const { result } = renderHook(() => useStoredTab('pageTab', TABS));
    act(() => result.current[1]('visibility'));
    expect(result.current[0]).toBe('visibility');

    const { result: reopened } = renderHook(() =>
      useStoredTab('pageTab', TABS)
    );
    expect(reopened.current[0]).toBe('visibility');
  });

  it('replaces a removed tab with the first supported tab', () => {
    localStorage.setItem('pageTab', 'styling');
    const { result } = renderHook(() => useStoredTab('pageTab', TABS));
    expect(result.current[0]).toBe('look');
    expect(localStorage.getItem('pageTab')).toBe('look');
  });
});
