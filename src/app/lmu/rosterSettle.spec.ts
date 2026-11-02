import { describe, expect, it } from 'vitest';
import {
  createRosterGate,
  ROSTER_MAX_WAIT_MS,
  ROSTER_SETTLE_MS,
} from './rosterSettle';

/**
 * The gate that keeps a filling grid from rebuilding the snapshot twenty
 * times.
 *
 * The numbers below are the real cadence: LMU admits one driver per session
 * poll, and the poll is every 500ms.
 */
const POLL = 500;

describe('createRosterGate', () => {
  it('does not hold back the first roster it sees', () => {
    // A session that is already fully joined would otherwise show nothing
    // until the settling window expired.
    const gate = createRosterGate();
    expect(gate.shouldWait('a,b,c', 0)).toBe(false);
  });

  it('does not hold back a roster that has not changed', () => {
    const gate = createRosterGate();
    gate.shouldWait('a', 0);
    expect(gate.shouldWait('a', POLL)).toBe(false);
    expect(gate.shouldWait('a', POLL * 10)).toBe(false);
  });

  it('waits out a burst that fits inside the cap, then rebuilds once', () => {
    // Three joins, half a second apart: 1.5s, inside the 2s cap. Nothing is
    // rebuilt while they arrive, and one rebuild happens once they stop.
    const gate = createRosterGate();
    gate.shouldWait('0', 0);

    let now = 0;
    let rebuilds = 0;
    for (let joined = 1; joined <= 3; joined += 1) {
      now += POLL;
      if (!gate.shouldWait(`${joined}`, now)) rebuilds += 1;
    }
    expect(rebuilds).toBe(0);

    // The roster holds still; the next poll past the settling window rebuilds.
    now += ROSTER_SETTLE_MS;
    expect(gate.shouldWait('3', now)).toBe(false);
  });

  it('rebuilds at the cap rather than never, while a grid keeps filling', () => {
    // Without the cap a join every 500ms resets the window forever and the
    // standings stay empty for as long as the grid takes to load.
    const gate = createRosterGate();
    gate.shouldWait('0', 0);

    let now = 0;
    let rebuilds = 0;
    for (let joined = 1; joined <= 20; joined += 1) {
      now += POLL;
      if (!gate.shouldWait(`${joined}`, now)) rebuilds += 1;
    }

    // 20 joins over 10s at a 2s cap: a handful of rebuilds, not twenty and
    // not none.
    expect(rebuilds).toBeGreaterThan(0);
    expect(rebuilds).toBeLessThan(8);
  });

  it('treats each burst separately', () => {
    const gate = createRosterGate();
    gate.shouldWait('a', 0);

    // First burst settles.
    expect(gate.shouldWait('b', POLL)).toBe(true);
    expect(gate.shouldWait('b', POLL + ROSTER_SETTLE_MS)).toBe(false);

    // A later change starts a fresh window rather than inheriting the cap.
    const later = POLL + ROSTER_SETTLE_MS + 10_000;
    expect(gate.shouldWait('c', later)).toBe(true);
    expect(gate.shouldWait('c', later + ROSTER_SETTLE_MS - 1)).toBe(true);
    expect(gate.shouldWait('c', later + ROSTER_SETTLE_MS)).toBe(false);
  });

  it('forgets everything on reset', () => {
    // The bridge resets on a disconnect, so a new session is not judged
    // against the last one's grid.
    const gate = createRosterGate();
    gate.shouldWait('a', 0);
    gate.shouldWait('b', POLL);

    gate.reset();
    expect(gate.shouldWait('c', POLL + 1)).toBe(false);
  });

  it('settles inside the cap', () => {
    // Otherwise the cap would fire first and the settling window would never
    // decide anything.
    expect(ROSTER_SETTLE_MS).toBeLessThan(ROSTER_MAX_WAIT_MS);
  });
});
