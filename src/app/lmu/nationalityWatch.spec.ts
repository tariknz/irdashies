import { describe, expect, it } from 'vitest';
import { createLmuNationalityWatch } from './nationalityWatch';

const ONLINE = 2;
const AI = 1;
const REMOTE = 2;

const grid = (
  names: readonly string[],
  overrides: { gameMode?: number; control?: number } = {}
) => ({
  gameMode: overrides.gameMode ?? ONLINE,
  drivers: names.map((name, id) => ({
    id,
    name,
    control: overrides.control ?? REMOTE,
  })),
});

describe('createLmuNationalityWatch', () => {
  it('calls for a burst when an online grid gains a driver', () => {
    const watch = createLmuNationalityWatch();
    expect(watch.observe(grid(['A', 'B']))).toBe(true);
    expect(watch.observe(grid(['A', 'B']))).toBe(false);
    expect(watch.observe(grid(['A', 'B', 'C']))).toBe(true);
    // A driver leaving is no reason to ask.
    expect(watch.observe(grid(['A', 'C']))).toBe(false);
  });

  it('calls for a burst when a driver who left comes back', () => {
    // B's flag may still have been missing when the last burst ran out; B
    // rejoining is the next chance to find it.
    const watch = createLmuNationalityWatch();
    expect(watch.observe(grid(['A', 'B']))).toBe(true);
    expect(watch.observe(grid(['A']))).toBe(false);
    expect(watch.observe(grid(['A', 'B']))).toBe(true);
  });

  it('never calls for one offline', () => {
    const watch = createLmuNationalityWatch();
    expect(watch.observe(grid(['A', 'B'], { gameMode: 0 }))).toBe(false);
    expect(watch.complete({ A: 'FR', B: 'DE' })).toBe(false);
  });

  it('asks again on returning online, even for the same drivers', () => {
    const watch = createLmuNationalityWatch();
    watch.observe(grid(['A']));
    watch.observe(grid(['A'], { gameMode: 0 }));
    expect(watch.observe(grid(['A']))).toBe(true);
  });

  it('asks again after a reset', () => {
    const watch = createLmuNationalityWatch();
    watch.observe(grid(['A']));
    watch.reset();
    expect(watch.observe(grid(['A']))).toBe(true);
  });

  it('is complete once every driver on the grid has a flag', () => {
    const watch = createLmuNationalityWatch();
    watch.observe(grid(['A', 'B']));
    expect(watch.complete(undefined)).toBe(false);
    expect(watch.complete({ A: 'FR' })).toBe(false);
    expect(watch.complete({ A: 'FR', B: 'DE' })).toBe(true);
    // Flags for drivers not on the grid do not matter either way.
    expect(watch.complete({ A: 'FR', B: 'DE', Gone: 'IT' })).toBe(true);
  });

  it('does not wait on AI entries or nameless slots', () => {
    const watch = createLmuNationalityWatch();
    watch.observe({
      gameMode: ONLINE,
      drivers: [
        { id: 0, name: 'Human', control: REMOTE },
        { id: 1, name: 'Bot', control: AI },
        { id: 2, name: '', control: REMOTE },
      ],
    });
    expect(watch.complete({ Human: 'FR' })).toBe(true);
  });

  it('waits on the player, whom the sim holds under AI control in the garage', () => {
    const watch = createLmuNationalityWatch();
    watch.observe({
      gameMode: ONLINE,
      playerHasVehicle: true,
      playerVehicleIdx: 0,
      drivers: [{ id: 0, name: 'Me', control: AI }],
    });
    expect(watch.complete({})).toBe(false);
    expect(watch.complete({ Me: 'FR' })).toBe(true);
  });

  it('is not complete for an empty grid', () => {
    const watch = createLmuNationalityWatch();
    watch.observe(grid([]));
    expect(watch.complete({})).toBe(false);
  });
});
