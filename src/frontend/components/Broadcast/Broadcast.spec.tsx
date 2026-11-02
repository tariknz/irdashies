import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDashboard } from '@irdashies/types';
import { DEMO_GROUPS } from '@irdashies/domain/broadcast/demoField';
import { TowerView } from './Broadcast';

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useDashboard: () => ({ currentDashboard: defaultDashboard }),
  useCarIdxSpeed: () => [],
  useSessionBarSelector: () => undefined,
}));

describe('TowerView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps one page per row when a position arrow shares its number with the page flip', () => {
    // seq 1 meets tick 1 after the first flip: the two used to share a key.
    const changes = new Map([[1, { delta: 1, seq: 1 }]]);
    const { container } = render(
      <TowerView
        settings={{ pageSeconds: 3 }}
        groups={DEMO_GROUPS}
        title="T"
        changes={changes}
        hasTyreChoice
        showGrid={false}
      />
    );
    for (let flip = 0; flip < 4; flip++) {
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      for (const row of container.querySelectorAll('.transition-transform')) {
        expect(row.querySelectorAll(':scope > .relative.h-full')).toHaveLength(
          1
        );
      }
    }
  });
});
