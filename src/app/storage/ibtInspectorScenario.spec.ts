import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { createIbtInspectorScenarioStore } from './ibtInspectorScenario';
import { isIbtInspectorScenario } from '../../types/ibtInspectorScenario';

vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));

it('roundtrips only one bounded scenario and safely handles corrupt data', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ibt-scenario-'));
  try {
    const store = createIbtInspectorScenarioStore(directory);
    expect(await store.read()).toBeNull();
    const scenario = {
      file: 'race.ibt',
      profileId: 'default',
      speed: 'max' as const,
      position: 1.25,
      loop: { start: 1, end: 2 },
    };
    await store.save(scenario);
    expect(await createIbtInspectorScenarioStore(directory).read()).toEqual(
      scenario
    );
    await store.save({ ...scenario, position: 1.5 });
    expect(
      JSON.parse(await readFile(path.join(directory, 'scenario.json'), 'utf8'))
        .position
    ).toBe(1.5);
    for (const value of [
      '{',
      'x'.repeat(4097),
      JSON.stringify({ ...scenario, file: '../race.ibt' }),
    ]) {
      await writeFile(path.join(directory, 'scenario.json'), value);
      expect(await store.read()).toBeNull();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('rejects invalid paths, non-finite positions and invalid loops', () => {
  const base = {
    file: 'race.ibt',
    profileId: 'default',
    speed: 1,
    position: 0,
    loop: null,
  };
  for (const invalid of [
    { file: '/tmp/race.ibt' },
    { speed: Infinity },
    { position: NaN },
    { loop: { start: 2, end: 1 } },
    { profileId: '' },
  ])
    expect(isIbtInspectorScenario({ ...base, ...invalid })).toBe(false);
});
