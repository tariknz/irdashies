import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { DeltaSpeedPreview } from './DeltaSpeedPreview';
import { useDeltaSpeed } from './hooks/useDeltaSpeed';
import { seedTrackState } from './mockTrackState';

vi.mock('./hooks/useDeltaSpeed', () => ({ useDeltaSpeed: vi.fn(() => null) }));
vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useGeneralSettings: () => ({}),
  useSessionVisibility: () => true,
}));

afterEach(() => vi.useRealTimers());

describe('Delta Speed demo data', () => {
  it('animates independently of live telemetry and ignores imported delta fields', () => {
    vi.useFakeTimers();
    seedTrackState();
    const importedConfig = {
      ...getWidgetDefaultConfig('deltaspeed'),
      previewDeltaKph: 20,
      deltaKph: 21,
    };
    const { unmount } = render(<DeltaSpeedPreview {...importedConfig} />);
    expect(screen.getByText('+4.2')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText('+1.1')).toBeInTheDocument();
    expect(useDeltaSpeed).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
