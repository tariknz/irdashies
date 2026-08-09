import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopSpeedStoreUpdater } from '@irdashies/context';
import {
  useStandingsSettings,
  useRelativeSettings,
  useInformationBarSettings,
} from '@irdashies/domain';
import { TopSpeedUpdater } from './TopSpeedUpdater';

vi.mock('@irdashies/context', () => ({
  TopSpeedStoreUpdater: vi.fn(() => null),
}));
vi.mock('@irdashies/domain', () => ({
  useStandingsSettings: vi.fn(),
  useRelativeSettings: vi.fn(),
  useInformationBarSettings: vi.fn(),
}));

const lastEnabledArg = () => {
  const calls = vi.mocked(TopSpeedStoreUpdater).mock.calls;
  return calls[calls.length - 1][0].enabled;
};

describe('TopSpeedUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStandingsSettings).mockReturnValue(undefined as never);
    vi.mocked(useRelativeSettings).mockReturnValue(undefined as never);
    vi.mocked(useInformationBarSettings).mockReturnValue(undefined as never);
  });

  it('does not mount TopSpeedStoreUpdater when no widget has topSpeed enabled', () => {
    render(<TopSpeedUpdater />);

    expect(TopSpeedStoreUpdater).not.toHaveBeenCalled();
  });

  it('is enabled when Standings footerBar.topSpeed is enabled', () => {
    vi.mocked(useStandingsSettings).mockReturnValue({
      footerBar: { topSpeed: { enabled: true } },
    } as never);

    render(<TopSpeedUpdater />);

    expect(lastEnabledArg()).toBe(true);
  });

  it('is enabled when Relative headerBar.topSpeed is enabled', () => {
    vi.mocked(useRelativeSettings).mockReturnValue({
      headerBar: { topSpeed: { enabled: true } },
    } as never);

    render(<TopSpeedUpdater />);

    expect(lastEnabledArg()).toBe(true);
  });

  it('is enabled when InformationBar topSpeed is enabled', () => {
    vi.mocked(useInformationBarSettings).mockReturnValue({
      topSpeed: { enabled: true },
    } as never);

    render(<TopSpeedUpdater />);

    expect(lastEnabledArg()).toBe(true);
  });
});
