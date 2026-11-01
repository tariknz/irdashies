import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ imports: vi.fn() }));
vi.mock('./tracks/by-id/1.json', () => {
  mocked.imports();
  return {
    default: { active: { inside: 'M0 0', outside: '' }, startFinish: {} },
  };
});
vi.mock('./tracks/by-id/2.json', () => {
  throw new Error('Chunk unavailable');
});
vi.mock('@irdashies/utils/logger', () => ({
  default: { warn: vi.fn() },
}));
import logger from '@irdashies/utils/logger';

describe('loadTrackDrawing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('lists IDs without importing drawings and rejects unavailable IDs', async () => {
    const { availableTrackIds, loadTrackDrawing } =
      await import('./trackDrawingLoader');
    expect(availableTrackIds).toContain(1);
    for (const id of [
      undefined,
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER,
    ]) {
      expect(await loadTrackDrawing(id)).toBeNull();
    }
    expect(mocked.imports).not.toHaveBeenCalled();
  });

  it('shares a request and its result between consumers', async () => {
    const { loadTrackDrawing } = await import('./trackDrawingLoader');
    const first = loadTrackDrawing(1);
    expect(loadTrackDrawing(1)).toBe(first);
    const drawing = await first;
    expect(drawing?.active.inside).toBe('M0 0');
    expect(await loadTrackDrawing(1)).toBe(drawing);
    expect(mocked.imports).toHaveBeenCalledTimes(1);
  });

  it('logs chunk failures and returns a safe missing-drawing result', async () => {
    const { loadTrackDrawing } = await import('./trackDrawingLoader');
    expect(await loadTrackDrawing(2)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Unable to load track drawing',
      2,
      // vmThreads can wrap import failures in an Error from another realm.
      expect.objectContaining({ message: expect.any(String) })
    );
  });
});
