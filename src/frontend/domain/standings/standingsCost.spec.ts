import { describe, expect, it, vi, beforeEach } from 'vitest';
import logger from '@irdashies/utils/logger';
import { measureStandingsRebuild, resetStandingsCost } from './standingsCost';

vi.mock('@irdashies/utils/logger', () => ({
  default: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const warn = vi.mocked(logger.warn);

/** Burns wall-clock, since the instrument reads performance.now() itself. */
const spin = (ms: number) => {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    /* deliberate */
  }
};

beforeEach(() => {
  resetStandingsCost();
  warn.mockClear();
});

describe('measureStandingsRebuild', () => {
  it('returns what the build returned', () => {
    expect(measureStandingsRebuild(20, () => 'rows')).toBe('rows');
  });

  it('says nothing about a fast rebuild', () => {
    measureStandingsRebuild(20, () => null);
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports a slow one, with the grid size', () => {
    measureStandingsRebuild(22, () => spin(12));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('22 drivers');
    expect(warn.mock.calls[0][0]).toMatch(/worst \d+\.\d+ms/);
  });

  it('reports the worst, not the latest', () => {
    measureStandingsRebuild(20, () => spin(14));
    const reported = String(warn.mock.calls[0][0]);
    const worst = Number(/worst (\d+\.\d+)ms/.exec(reported)?.[1]);
    expect(worst).toBeGreaterThanOrEqual(12);
  });

  it('throttles, so one slow rebuild does not bury the log', () => {
    // A rebuild slow once is slow every time, and this runs twice a second.
    for (let i = 0; i < 5; i += 1) measureStandingsRebuild(20, () => spin(10));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('counts the rebuilds it stayed quiet for', () => {
    measureStandingsRebuild(20, () => null);
    measureStandingsRebuild(20, () => null);
    measureStandingsRebuild(20, () => spin(10));
    expect(warn.mock.calls[0][0]).toContain('over 3 rebuilds');
  });
});
