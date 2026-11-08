import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSectorTimingStore } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { SectorDelta } from './SectorDelta';
import { SectorDeltaDisplay } from './SectorDeltaDisplay';
import type { SectorDeltaData } from './SectorDeltaDisplay';

const mode = vi.hoisted(() => ({ isDemoMode: true }));
vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => mode,
  useSessionStore: () => [
    { SectorNum: 0, SectorStartPct: 0 },
    { SectorNum: 1, SectorStartPct: 0.5 },
  ],
}));
vi.mock('./SectorDeltaDisplay', () => ({
  SectorDeltaDisplay: vi.fn((props: { data: SectorDeltaData }) => (
    <div>{props.data.currentSectorIdx}</div>
  )),
}));

afterEach(() => vi.useRealTimers());

describe('Sector Delta demo', () => {
  it('animates local data without overwriting shared timing, then restores live data', () => {
    vi.useFakeTimers();
    mode.isDemoMode = true;
    useSectorTimingStore.getState().reset();
    const before = useSectorTimingStore.getState();
    const config = getWidgetDefaultConfig('sectordelta');
    const { rerender, unmount } = render(<SectorDelta {...config} />);
    const displayed = () =>
      vi.mocked(SectorDeltaDisplay).mock.lastCall?.[0].data;
    expect(displayed()?.currentLapSectorTimes).toEqual([17.85, 19.62]);
    act(() => vi.advanceTimersByTime(3000));
    expect(displayed()?.currentSectorIdx).toBe(1);
    expect(useSectorTimingStore.getState()).toBe(before);
    mode.isDemoMode = false;
    rerender(<SectorDelta {...config} />);
    expect(displayed()?.sectors).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
});
