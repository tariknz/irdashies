import { describe, expect, it } from 'vitest';
import { demoRacePlanSnapshot, demoRacePlanState } from './demoData';
import { buildStintPlanView } from './stintPlanView';

const options = { timeZone: 'UTC' };

describe('buildStintPlanView', () => {
  it('describes the stint in the car', () => {
    const view = buildStintPlanView(
      demoRacePlanSnapshot({ driftSec: 134, fuelPerLap: 1.08 }),
      demoRacePlanState,
      options
    );
    expect(view).toMatchObject({
      stintLabel: 'Stint 4/23',
      driverName: 'Driver D',
      lapLabel: 'Lap 13 of 34',
      boxKind: 'box-in',
      boxLabel: 'Box in 21',
      fuelTarget: '1.05',
      fuelActual: '1.08',
      fuelLevel: 'over',
      fuelVisible: true,
      nextLabel: 'Next',
      nextDriverName: 'Driver E',
      driftText: '+2:14 behind plan',
      driftLevel: 'behind',
    });
    // Stint 5 starts 4 x 3710 s plus the drift after 12:00 UTC.
    expect(view.nextStart).toBe('16:09 (+4:09)');
    expect(view.clashes).toEqual({ clashes: 0, warnings: 0, text: '' });
  });

  it('takes the fuel target from the plan stint a split stint stands for', () => {
    const state = structuredClone(demoRacePlanState);
    const planStint3 = state.planning?.strategies[0].stints.find(
      (stint) => stint.number === 3
    );
    if (!planStint3) throw new Error('demo plan has no stint 3');
    planStint3.fuel = 34;
    const snapshot = demoRacePlanSnapshot();
    const index = snapshot.currentStintIndex ?? 0;
    snapshot.stints[index] = { ...snapshot.stints[index], planNumber: 3 };
    const view = buildStintPlanView(snapshot, state, options);
    expect(view.stintLabel).toBe('Stint 4/23');
    expect(view.fuelTarget).toBe('1.00');
  });

  it('is on the box lap', () => {
    const view = buildStintPlanView(
      demoRacePlanSnapshot({ lapsInStint: 33 }),
      demoRacePlanState
    );
    expect(view.boxKind).toBe('box-now');
    expect(view.boxLabel).toBe('Box this lap');
  });

  it('has no fuel figures when the fuel cannot be seen', () => {
    const view = buildStintPlanView(
      demoRacePlanSnapshot({ fuelVisible: false }),
      demoRacePlanState
    );
    expect(view.fuelVisible).toBe(false);
    expect(view.fuelActual).toBeNull();
    expect(view.fuelLevel).toBe('unknown');
  });

  it('counts clashes', () => {
    const view = buildStintPlanView(
      demoRacePlanSnapshot({ driftSec: 900 }),
      demoRacePlanState
    );
    expect(view.clashes.clashes).toBe(1);
    expect(view.clashes.warnings).toBe(1);
  });

  it('gives the first stint before green', () => {
    const view = buildStintPlanView(
      demoRacePlanSnapshot({ status: 'waiting' }),
      demoRacePlanState,
      options
    );
    expect(view.stintLabel).toBe('Stint 1/23');
    expect(view.driverName).toBeNull();
    expect(view.lapLabel).toBeNull();
    expect(view.nextLabel).toBe('First stint');
    expect(view.nextDriverName).toBe('Driver A');
    expect(view.nextStart).toBe('12:00 (+0:00)');
    expect(view.driftText).toBeNull();
  });

  it('works without a planning', () => {
    const view = buildStintPlanView(demoRacePlanSnapshot(), null);
    expect(view.driverName).toBe('Unknown driver');
    expect(view.fuelTarget).toBeNull();
  });
});
