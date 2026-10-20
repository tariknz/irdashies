import { describe, expect, it } from 'vitest';
import { lmuSessionUniqueId } from './sessionIdentity';

const base = {
  trackName: 'Algarve International Circuit',
  session: 1,
  serverName: 'Some Server',
};

describe('lmuSessionUniqueId', () => {
  it('changes when the track does', () => {
    // The case that showed the bug: both practice, so LMU reported session 1
    // for each and every consumer kept the previous grid.
    expect(lmuSessionUniqueId(base)).not.toBe(
      lmuSessionUniqueId({ ...base, trackName: 'Circuit of the Americas' })
    );
  });

  it('changes between practice, qualifying and the race', () => {
    const ids = [1, 2, 3].map((session) =>
      lmuSessionUniqueId({ ...base, session })
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('separates two servers running the same event', () => {
    // Otherwise they would share stored lap history.
    expect(lmuSessionUniqueId(base)).not.toBe(
      lmuSessionUniqueId({ ...base, serverName: 'Another Server' })
    );
  });

  it('is the same session on a rejoin', () => {
    // Stable rather than unique per join, so reconnecting finds its history.
    expect(lmuSessionUniqueId(base)).toBe(lmuSessionUniqueId({ ...base }));
  });

  it('answers for a single-player session with no server', () => {
    const offline = lmuSessionUniqueId({ trackName: 'Spa', session: 1 });
    expect(offline).toBeGreaterThan(0);
    expect(offline).toBe(
      lmuSessionUniqueId({ trackName: 'Spa', session: 1, serverName: '' })
    );
  });

  it('never returns the reserved zero', () => {
    // ReplayContextProcessor reads 0 as "no session named".
    expect(lmuSessionUniqueId({})).toBeGreaterThan(0);
  });

  it('cannot be confused by a value running into the next', () => {
    expect(lmuSessionUniqueId({ trackName: 'ab', serverName: 'c' })).not.toBe(
      lmuSessionUniqueId({ trackName: 'a', serverName: 'bc' })
    );
  });
});
