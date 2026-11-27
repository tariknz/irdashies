import { describe, expect, it } from 'vitest';
import { LmuSampleGate, type SampleGateInput } from './sampleGate';

const LAP_M = 5000;
const SPEED = 50;

const frame = (
  time: number,
  pcts: number[],
  overrides: Partial<SampleGateInput> = {}
): SampleGateInput => ({
  time,
  lapDistM: LAP_M,
  live: true,
  pcts,
  speeds: pcts.map(() => SPEED),
  ...overrides,
});

const driveTo = (
  gate: LmuSampleGate,
  from: number,
  to: number,
  start = 0.1
) => {
  let pct = start;
  for (let time = from; time < to; time += 0.01) {
    gate.update(frame(time, [pct % 1, (pct + 0.2) % 1]));
    pct += (SPEED * 0.01) / LAP_M;
  }
  return pct % 1;
};

describe('LmuSampleGate', () => {
  it('accepts cars driving steadily, from their second frame', () => {
    const gate = new LmuSampleGate();
    gate.update(frame(0, [0.1, 0.3]));
    expect(gate.valid[0]).toBe(0);

    driveTo(gate, 0.01, 1);
    expect(gate.valid[0]).toBe(1);
    expect(gate.valid[1]).toBe(1);
    expect(gate.describe()).toBe('');
  });

  it('refuses a car at the start of the lap, by either fraction', () => {
    const gate = new LmuSampleGate();
    driveTo(gate, 0, 1);
    gate.update(
      frame(1.2, [0, 0.3], { scoringPcts: [0.1, 0], speeds: [SPEED, SPEED] })
    );

    expect(gate.valid[0]).toBe(0);
    expect(gate.valid[1]).toBe(0);
    expect(gate.counts.beforeLine).toBe(2);
    expect(gate.describe()).toContain('2 car samples before the start line');
  });

  it('starts a car that left the frame afresh when it comes back', () => {
    const gate = new LmuSampleGate();
    const pct = driveTo(gate, 0, 1);
    gate.update(frame(1, [pct]));
    gate.update(frame(1.01, [pct + 0.004, 0.3 + (SPEED * 1.01) / LAP_M]));

    expect(gate.valid[1]).toBe(0);
    expect(gate.counts.jumping).toBe(0);

    gate.update(frame(1.02, [pct + 0.0041, 0.3 + (SPEED * 1.02) / LAP_M]));
    expect(gate.valid[1]).toBe(1);
  });

  it('holds back a jump of a car whose speed is unknown', () => {
    const gate = new LmuSampleGate();
    const noSpeed = { speeds: undefined };
    gate.update(frame(0, [0.1], noSpeed));
    gate.update(frame(0.01, [0.1001], noSpeed));
    expect(gate.valid[0]).toBe(1);

    gate.update(frame(0.02, [0.3], noSpeed));
    expect(gate.valid[0]).toBe(0);
    gate.update(frame(0.03, [0.3001], noSpeed));
    expect(gate.valid[0]).toBe(0);
  });

  it('holds back a car that jumps along the lap for two seconds', () => {
    const gate = new LmuSampleGate();
    const pct = driveTo(gate, 0, 1);
    gate.update(frame(1, [pct + 0.2, pct + 0.2]));
    expect(gate.valid[0]).toBe(0);

    let moving = pct + 0.2;
    for (let time = 1.01; time < 2.5; time += 0.01) {
      moving += (SPEED * 0.01) / LAP_M;
      gate.update(frame(time, [moving, moving + 0.2]));
    }
    expect(gate.valid[0]).toBe(0);
    expect(gate.counts.jumping).toBeGreaterThan(0);

    for (let time = 2.5; time < 3.2; time += 0.01) {
      moving += (SPEED * 0.01) / LAP_M;
      gate.update(frame(time, [moving, moving + 0.2]));
    }
    expect(gate.valid[0]).toBe(1);
  });

  it('crosses the finish line without calling it a jump', () => {
    const gate = new LmuSampleGate();
    driveTo(gate, 0, 3, 0.999);

    expect(gate.valid[0]).toBe(1);
    expect(gate.counts.jumping).toBe(0);
  });

  it('refuses everything while the data is stale, then starts afresh', () => {
    const gate = new LmuSampleGate();
    driveTo(gate, 0, 1);
    gate.update(frame(1.2, [0.2, 0.4], { live: false }));
    expect(gate.valid[0]).toBe(0);
    expect(gate.counts.stale).toBe(1);

    gate.update(frame(1.21, [0.2, 0.4]));
    expect(gate.valid[0]).toBe(0);
    gate.update(frame(1.22, [0.2001, 0.4001]));
    expect(gate.valid[0]).toBe(1);
  });

  it('counts at most ten times a second', () => {
    const gate = new LmuSampleGate();
    for (let time = 0; time < 1; time += 0.01) {
      gate.update(frame(time, [0, 0]));
    }

    expect(gate.counts.beforeLine).toBeLessThanOrEqual(22);
    expect(gate.counts.beforeLine).toBeGreaterThanOrEqual(18);
  });

  it('forgets everything on reset', () => {
    const gate = new LmuSampleGate();
    gate.update(frame(0, [0, 0]));
    gate.reset();

    expect(gate.counts.beforeLine).toBe(0);
    expect(gate.describe()).toBe('');
  });
});
