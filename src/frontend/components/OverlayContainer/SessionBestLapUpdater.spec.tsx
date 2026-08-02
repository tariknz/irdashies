import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionBestLapStoreUpdater } from '@irdashies/context';
import {
  useStandingsSettings,
  useRelativeSettings,
  useInformationBarSettings,
} from '../Standings/hooks';
import { SessionBestLapUpdater } from './SessionBestLapUpdater';

vi.mock('@irdashies/context', () => ({
  SessionBestLapStoreUpdater: vi.fn(() => null),
}));
vi.mock('../Standings/hooks', () => ({
  useStandingsSettings: vi.fn(),
  useRelativeSettings: vi.fn(),
  useInformationBarSettings: vi.fn(),
}));

describe('SessionBestLapUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStandingsSettings).mockReturnValue(undefined as never);
    vi.mocked(useRelativeSettings).mockReturnValue(undefined as never);
    vi.mocked(useInformationBarSettings).mockReturnValue(undefined as never);
  });

  it('does not mount SessionBestLapStoreUpdater when neither lastLap nor bestLap is enabled anywhere', () => {
    render(<SessionBestLapUpdater />);

    expect(SessionBestLapStoreUpdater).not.toHaveBeenCalled();
  });

  it('mounts SessionBestLapStoreUpdater when Standings headerBar.lastLap is enabled', () => {
    vi.mocked(useStandingsSettings).mockReturnValue({
      headerBar: { lastLap: { enabled: true } },
    } as never);

    render(<SessionBestLapUpdater />);

    expect(SessionBestLapStoreUpdater).toHaveBeenCalled();
  });

  it('mounts SessionBestLapStoreUpdater when InformationBar bestLap is enabled', () => {
    vi.mocked(useInformationBarSettings).mockReturnValue({
      bestLap: { enabled: true },
    } as never);

    render(<SessionBestLapUpdater />);

    expect(SessionBestLapStoreUpdater).toHaveBeenCalled();
  });
});
