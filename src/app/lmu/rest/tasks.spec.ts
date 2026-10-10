import { describe, expect, it } from 'vitest';
import { at, finiteNumber, LMU_REST_TASKS } from './tasks';
import { createLmuRestData } from './state';
import {
  pitstopEstimateFixture,
  repairAndRefuelFixture,
  repairAndRefuelVirtualEnergyFixture,
  carSetupOverviewFixture,
  sessionsFixture,
  weatherFixture,
} from './restFixture';

const taskById = (id: string) => {
  const task = LMU_REST_TASKS.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`no task ${id}`);
  return task;
};

/** Runs a task's outputs over a payload, as the poller does. */
const apply = (id: string, payload: unknown) => {
  const data = createLmuRestData();
  const applied: string[] = [];
  taskById(id).outputs.forEach((output) => {
    const value = output.parse(payload);
    if (value === undefined) return;
    output.apply(data, value);
    applied.push(output.id);
  });
  return { data, applied };
};

describe('at', () => {
  it('walks a key path', () => {
    expect(at({ a: { b: { c: 7 } } }, ['a', 'b', 'c'])).toBe(7);
  });

  it('gives up rather than throwing on a missing or non-object link', () => {
    expect(at({ a: 1 }, ['a', 'b'])).toBeUndefined();
    expect(at({}, ['a', 'b', 'c'])).toBeUndefined();
    expect(at(null, ['a'])).toBeUndefined();
    expect(at(undefined, ['a'])).toBeUndefined();
    expect(at('a string', ['length'])).toBeUndefined();
  });

  it('returns the payload itself for an empty path', () => {
    expect(at({ a: 1 }, [])).toEqual({ a: 1 });
  });
});

describe('finiteNumber', () => {
  it('accepts only finite numbers', () => {
    expect(finiteNumber(0)).toBe(0);
    expect(finiteNumber(-1.5)).toBe(-1.5);
  });

  it('rejects everything else, including numeric strings', () => {
    // A numeric string would otherwise reach a telemetry cell typed number.
    [NaN, Infinity, -Infinity, '12', '', null, undefined, {}, [], true].forEach(
      (value) => expect(finiteNumber(value)).toBeUndefined()
    );
  });
});

describe('pitstop-estimate task', () => {
  it('reads the stop and repair estimates', () => {
    const { data, applied } = apply(
      'pitstop-estimate',
      pitstopEstimateFixture()
    );

    expect(data.cells.pitStopTime?.value[0]).toBe(32.5);
    expect(data.cells.repairTime?.value[0]).toBe(12.25);
    expect(applied).toEqual(['pitStopTime', 'repairTime']);
  });

  it('is a repeating task, since the estimate moves with damage', () => {
    expect(taskById('pitstop-estimate').mode).toBe('repeat');
  });

  it('writes nothing to the session, so it cannot force a republish', () => {
    // Everything here is on the ungated telemetry path by design -- a session
    // target would rebuild the whole snapshot on every poll.
    taskById('pitstop-estimate').outputs.forEach((output) =>
      expect(output.target).toBe('telemetry')
    );
  });

  it('applies nothing when the keys are missing', () => {
    const { data, applied } = apply('pitstop-estimate', {});

    expect(applied).toEqual([]);
    expect(data.cells.pitStopTime).toBeUndefined();
  });

  it('applies only what it recognises from a partial payload', () => {
    const { data, applied } = apply('pitstop-estimate', { total: 20 });

    expect(data.cells.pitStopTime?.value[0]).toBe(20);
    expect(data.cells.repairTime).toBeUndefined();
    expect(applied).toEqual(['pitStopTime']);
  });

  it('survives a wholesale garbage payload without throwing', () => {
    // LMU's shapes change between builds; a surprise must cost one missing
    // property, not a dead poller.
    [
      { error: 'nope' },
      null,
      undefined,
      'a string',
      42,
      [],
      { total: 'soon', damage: null },
      { total: { nested: 1 } },
    ].forEach((payload) => {
      expect(() => apply('pitstop-estimate', payload)).not.toThrow();
      expect(apply('pitstop-estimate', payload).applied).toEqual([]);
    });
  });
});

describe('LMU_REST_TASKS', () => {
  it('gives every task a distinct id and a sane interval', () => {
    const ids = LMU_REST_TASKS.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
    LMU_REST_TASKS.forEach((task) => {
      expect(task.baseIntervalMs).toBeGreaterThan(0);
      expect(task.path.startsWith('/rest/')).toBe(true);
      expect(task.outputs.length).toBeGreaterThan(0);
    });
  });

  it('gives every output a distinct id within its task', () => {
    LMU_REST_TASKS.forEach((task) => {
      const ids = task.outputs.map((output) => output.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe('repair-and-refuel task', () => {
  it('reads wear and damage from the wearables block', () => {
    const { data } = apply('repair-and-refuel', repairAndRefuelFixture());

    expect(data.cells.aeroDamage?.value[0]).toBe(0.12);
    // LF, RF, LR, RR -- LMU's order and this repo's are the same, so there is
    // no remapping here and nobody should add one.
    expect(data.cells.brakeWear?.value).toEqual([0.9, 0.88, 0.95, 0.94]);
    expect(data.cells.suspensionDamage?.value).toEqual([1, 1, 0.97, 1]);
  });

  it('reads a fuel target in litres and flags it as fuel', () => {
    const { data } = apply('repair-and-refuel', repairAndRefuelFixture());

    expect(data.cells.refuelTarget?.value[0]).toBe(45);
    expect(data.cells.refuelTargetIsVirtualEnergy?.value[0]).toBe(false);
  });

  it('converts a gallon target to litres', () => {
    const payload = repairAndRefuelFixture();
    payload.pitMenu.pitMenu[1].settings = [{ text: '+12.5 gal' }];
    payload.pitMenu.pitMenu[1].currentSetting = 0;

    const { data } = apply('repair-and-refuel', payload);

    // 12.5 US gallons at 3.7854118 L/gal.
    expect(data.cells.refuelTarget?.value[0]).toBeCloseTo(47.32, 2);
    expect(data.cells.refuelTargetIsVirtualEnergy?.value[0]).toBe(false);
  });

  it('reads a virtual-energy target as a percentage and flags it', () => {
    // An energy-limited car. The flag is the only thing distinguishing 78%
    // from 78 litres, so it has to travel with the number.
    const { data } = apply(
      'repair-and-refuel',
      repairAndRefuelVirtualEnergyFixture()
    );

    expect(data.cells.refuelTarget?.value[0]).toBe(78);
    expect(data.cells.refuelTargetIsVirtualEnergy?.value[0]).toBe(true);
  });

  it('prefers virtual energy when the menu offers both', () => {
    // The VE fixture also carries a FUEL entry; VE comes first and wins,
    // matching how the sim presents an energy-limited car.
    const { data } = apply(
      'repair-and-refuel',
      repairAndRefuelVirtualEnergyFixture()
    );

    expect(data.cells.refuelTargetIsVirtualEnergy?.value[0]).toBe(true);
  });

  it('sends maxVirtualEnergy to the session, not to telemetry', () => {
    // A per-car constant. On telemetry it would force a session rebuild on
    // every one of these 5 Hz polls.
    const { data } = apply('repair-and-refuel', repairAndRefuelFixture());

    expect(data.session.maxVirtualEnergy).toBe(100);
    const output = LMU_REST_TASKS.find(
      (task) => task.id === 'repair-and-refuel'
    )?.outputs.find((o) => o.id === 'maxVirtualEnergy');
    expect(output?.target).toBe('session');
  });

  it('sends the tank size to the session as well', () => {
    // The pit screen states the tank outright, which is the one source for it
    // that is not an inference.
    const { data } = apply('repair-and-refuel', repairAndRefuelFixture());

    expect(data.session.maxFuel).toBe(120);
  });

  it('leaves the tank unset when the payload has no fuelInfo', () => {
    const payload = repairAndRefuelFixture() as Record<string, unknown>;
    delete payload.fuelInfo;

    const { data } = apply('repair-and-refuel', payload);

    expect(data.session.maxFuel).toBeUndefined();
  });

  it('rejects a corner array that is not exactly four long', () => {
    // Publishing three would leave a consumer indexing corner 3 with
    // undefined, which is worse than publishing nothing.
    const payload = repairAndRefuelFixture();
    payload.wearables.brakes = [0.9, 0.88, 0.95];

    const { data } = apply('repair-and-refuel', payload);

    expect(data.cells.brakeWear).toBeUndefined();
    expect(data.cells.suspensionDamage?.value).toHaveLength(4);
  });

  it('rejects a corner array holding a non-number', () => {
    const payload = repairAndRefuelFixture();
    payload.wearables.brakes = [0.9, 0.88, 0.95, null] as number[];

    expect(
      apply('repair-and-refuel', payload).data.cells.brakeWear
    ).toBeUndefined();
  });

  it('ignores a fuel entry whose text holds no number', () => {
    const payload = repairAndRefuelFixture();
    payload.pitMenu.pitMenu[1].settings = [{ text: 'No Change' }];
    payload.pitMenu.pitMenu[1].currentSetting = 0;

    const { data } = apply('repair-and-refuel', payload);

    expect(data.cells.refuelTarget).toBeUndefined();
  });

  it('ignores a fuel entry whose index is out of range', () => {
    const payload = repairAndRefuelFixture();
    payload.pitMenu.pitMenu[1].currentSetting = 99;

    const { data } = apply('repair-and-refuel', payload);

    expect(data.cells.refuelTarget).toBeUndefined();
  });

  it('survives a garbage payload without throwing', () => {
    [
      { error: 'nope' },
      null,
      'string',
      { pitMenu: 7 },
      { wearables: [] },
    ].forEach((payload) => {
      expect(() => apply('repair-and-refuel', payload)).not.toThrow();
    });
  });
});

describe('sessions task', () => {
  it('reads the session settings LMU nests under currentValue', () => {
    const { data } = apply('sessions', sessionsFixture());

    expect(data.session.timeScale).toBe(6);
    expect(data.session.privateQualifying).toBe(true);
  });

  it('reads a zero private-qualifying flag as false', () => {
    const { data } = apply('sessions', {
      ...sessionsFixture(),
      SESSSET_private_qual: { currentValue: 0 },
    });

    expect(data.session.privateQualifying).toBe(false);
  });

  it('is fetched once, since session settings cannot change mid-session', () => {
    expect(LMU_REST_TASKS.find((task) => task.id === 'sessions')?.mode).toBe(
      'once'
    );
  });

  it('targets the session, so it forces a republish', () => {
    // These only reach widgets through the session snapshot, which is gated by
    // the signature -- so a telemetry target here would never be published.
    LMU_REST_TASKS.find((task) => task.id === 'sessions')?.outputs.forEach(
      (output) => expect(output.target).toBe('session')
    );
  });

  it('applies nothing for a payload missing the settings', () => {
    expect(apply('sessions', { other: 1 }).applied).toEqual([]);
  });
});

describe('sessions-weather task', () => {
  it('reads five forecast points per session type', () => {
    const { data } = apply('sessions-weather', weatherFixture());

    expect(data.session.forecast?.practice).toHaveLength(5);
    expect(data.session.forecast?.qualify).toHaveLength(5);
    expect(data.session.forecast?.race).toHaveLength(5);
  });

  it('spaces the points evenly across the session', () => {
    const { data } = apply('sessions-weather', weatherFixture());

    expect(data.session.forecast?.race?.map((n) => n.start)).toEqual([
      0, 0.2, 0.4, 0.6, 0.8,
    ]);
  });

  it('normalises rain chance from a percentage to a fraction', () => {
    // So no consumer has to know which convention it arrived in.
    const { data } = apply('sessions-weather', weatherFixture());
    const race = data.session.forecast?.race ?? [];

    expect(race[0].rainChance).toBeCloseTo(0.3, 5);
    expect(race[2].rainChance).toBe(1);
  });

  it('clamps a rain chance outside 0..100', () => {
    const payload = weatherFixture();
    payload.RACE.START.WNV_RAIN_CHANCE.currentValue = 150;
    payload.RACE.NODE_25.WNV_RAIN_CHANCE.currentValue = -20;

    const { data } = apply('sessions-weather', payload);
    const race = data.session.forecast?.race ?? [];

    expect(race[0].rainChance).toBe(1);
    expect(race[1].rainChance).toBe(0);
  });

  it('keeps temperature and sky type as reported', () => {
    const { data } = apply('sessions-weather', weatherFixture());
    const race = data.session.forecast?.race ?? [];

    expect(race[2].temperature).toBe(18);
    expect(race[2].skyType).toBe(5);
  });

  it('rejects a partial forecast rather than publishing a cliff', () => {
    // Four points rendered as five would read as a sudden change at the end.
    const payload = weatherFixture() as Record<string, unknown>;
    delete (payload.RACE as Record<string, unknown>).FINISH;

    const { data } = apply('sessions-weather', payload);

    expect(data.session.forecast?.race).toBeUndefined();
    // The other session types are independent and still land.
    expect(data.session.forecast?.practice).toHaveLength(5);
  });

  it('survives a garbage payload without throwing', () => {
    [{ RACE: 7 }, null, 'nope', {}].forEach((payload) => {
      expect(() => apply('sessions-weather', payload)).not.toThrow();
    });
  });
});

describe('car-setup-overview task', () => {
  it('reads the fuel ratio from the garage setup', () => {
    const { data } = apply('car-setup-overview', carSetupOverviewFixture());

    expect(data.session.fuelRatio).toBeCloseTo(0.83, 5);
  });

  it('reads the displayed number, not the slider index', () => {
    // VM_FUEL_LEVEL carries both: stringValue "0.83" is the ratio, value 82 is
    // where the slider sits. Reading the latter would be wrong by ~100x.
    const { data } = apply('car-setup-overview', carSetupOverviewFixture());

    expect(data.session.fuelRatio).not.toBe(82);
    expect(data.session.fuelRatio).toBeLessThan(2);
  });

  it('relates virtual energy to litres, which is the point of it', () => {
    // The fixture mirrors a real payload: 23% at 0.83 L/% is 19.1 L, the
    // figure the garage shows for fuel capacity.
    const { data } = apply('car-setup-overview', carSetupOverviewFixture());
    const ratio = data.session.fuelRatio ?? 0;

    expect(23 * ratio).toBeCloseTo(19.1, 1);
  });

  it('targets the session, since a setup value is not per-frame', () => {
    const task = LMU_REST_TASKS.find((t) => t.id === 'car-setup-overview');
    task?.outputs.forEach((output) => expect(output.target).toBe('session'));
  });

  it('repeats, because a setup can be edited mid-session', () => {
    // A one-shot would go stale the moment the player changed the slider.
    expect(
      LMU_REST_TASKS.find((t) => t.id === 'car-setup-overview')?.mode
    ).toBe('repeat');
  });

  it('applies nothing when the setup key is absent', () => {
    expect(
      apply('car-setup-overview', { carSetup: { garageValues: {} } }).applied
    ).toEqual([]);
  });

  it('ignores a non-numeric setup string', () => {
    const payload = {
      carSetup: {
        garageValues: { VM_FUEL_LEVEL: { stringValue: 'Non-adjustable' } },
      },
    };

    expect(apply('car-setup-overview', payload).applied).toEqual([]);
  });

  it('survives a garbage payload without throwing', () => {
    [
      { carSetup: 7 },
      null,
      'nope',
      {},
      { carSetup: { garageValues: 3 } },
    ].forEach((payload) => {
      expect(() => apply('car-setup-overview', payload)).not.toThrow();
    });
  });
});

describe('car-setup-overview fuel slider maximum', () => {
  it('reads maxValue, which is the LMGTE tank in litres', () => {
    const { data } = apply('car-setup-overview', carSetupOverviewFixture());

    expect(data.session.fuelLevelMax).toBe(120);
  });

  it('keeps it distinct from the ratio', () => {
    // Two numbers from one node, meaning different things: 0.83 L per percent
    // and a 120 L bound. Crossing them over is wrong by about a hundred times.
    const { data } = apply('car-setup-overview', carSetupOverviewFixture());

    expect(data.session.fuelRatio).toBeCloseTo(0.83, 5);
    expect(data.session.fuelLevelMax).toBe(120);
  });

  it('applies nothing when maxValue is absent', () => {
    const payload = {
      carSetup: { garageValues: { VM_FUEL_LEVEL: { stringValue: '0.83' } } },
    };

    const { data } = apply('car-setup-overview', payload);

    expect(data.session.fuelRatio).toBeCloseTo(0.83, 5);
    expect(data.session.fuelLevelMax).toBeUndefined();
  });
});
