import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { useLapTimesStoreUpdater } from '@irdashies/context';
import { GantryStandings } from './GantryStandings';

vi.mock('@irdashies/domain', () => ({
  useHighlightColor: () => 0xffffff,
}));

vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: vi.fn(() => []),
}));

vi.mock('@irdashies/context', () => ({
  useLapTimesStoreUpdater: vi.fn(),
}));

describe('GantryStandings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables the three displayed lap-delta columns', () => {
    render(<GantryStandings followedCarIdx={null} />);

    expect(useLapTimesStoreUpdater).toHaveBeenCalledWith(true);
    expect(useDriverStandings).toHaveBeenCalledWith(
      expect.objectContaining({
        lapTimeDeltas: { enabled: true, numLaps: 3 },
      }),
      { showAll: true }
    );
  });
});
