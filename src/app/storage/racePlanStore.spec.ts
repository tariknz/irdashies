import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));
import {
  createRacePlanStore,
  defaultRacePlanState,
  sanitizeRacePlanState,
} from './racePlanStore';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

async function target() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'irdashies-race-plan-'));
  dirs.push(dir);
  return path.join(dir, 'race-plan.json');
}

describe('race plan store', () => {
  it('returns defaults for a missing or corrupt file', async () => {
    const file = await target();
    expect(await createRacePlanStore(file).load()).toEqual(
      defaultRacePlanState()
    );
    await writeFile(file, '{bad');
    expect(await createRacePlanStore(file).load()).toEqual(
      defaultRacePlanState()
    );
  });

  it('drops values of the wrong shape', () => {
    expect(
      sanitizeRacePlanState({
        config: { planningId: -4, strategyId: 'x', refreshMinutes: 90 },
        encryptedApiKey: 'not base64!',
        cache: { planning: [], fetchedAt: 'now' },
      })
    ).toEqual(defaultRacePlanState());
  });

  it('flushes a debounced save and reads it back', async () => {
    const file = await target();
    const store = createRacePlanStore(file);
    await store.load();
    const state = {
      config: { planningId: 9001, strategyId: 7001, refreshMinutes: 10 },
      encryptedApiKey: 'c2VjcmV0',
      cache: { planning: { id: 9001 }, fetchedAt: 1_000 },
    };
    store.save(state);
    await store.flush();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(state);
    expect(await createRacePlanStore(file).load()).toEqual(state);
  });

  it('keeps a failed write pending, so the next flush saves it', async () => {
    const dir = path.dirname(await target());
    const blocked = path.join(dir, 'blocked');
    await writeFile(blocked, '');
    const file = path.join(blocked, 'race-plan.json');
    const store = createRacePlanStore(file);
    await store.load();
    const state = { ...defaultRacePlanState(), encryptedApiKey: 'c2VjcmV0' };
    store.save(state);
    await store.flush();
    await rm(blocked);
    await store.flush();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(state);
  });
});
